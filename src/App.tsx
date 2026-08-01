import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Project, Viewport, Tool, Point, DraftState, Feature, 
  Layer, ProjectSettings, SnapMode, AreaUnit, PrintSettings
} from './types';
import { CanvasStage } from './components/CanvasStage';
import { RibbonMenu } from './components/RibbonMenu';
import { Toolbar } from './components/Toolbar';
import { LayerPanel } from './components/LayerPanel';
import { ObjectPanel } from './components/ObjectPanel';
import { PropertiesPanel } from './components/PropertiesPanel';
import { MiniMap } from './components/MiniMap';
import { StatusBar } from './components/StatusBar';
import { PrintDialog } from './components/PrintDialog';
import { HistoryPanel } from './components/HistoryPanel';
import { AILayoutGenerator } from './components/AILayoutGenerator';
import { HistoryDialog } from './components/HistoryDialog';
import { CLIPARTS } from './data/cliparts';
import { createId, nowIso, toPolygonPoints, mergeAdjacentPolygons, featureCenter, geometryBounds } from './lib/geometry';
import { ProjectManager } from './core/ProjectManager';
import { createDefaultProject } from './data/defaultProject';
import { 
  exportToPNG, exportToJPEG, exportToPDF, 
  projectToSvg, projectToDxf, projectToGeoJson, projectToCsv,
  renderProjectToOffscreenCanvas
} from './lib/exporters';
import './styles.css';

// Custom hook for undo/redo with jump support
function useProjectHistory(initialProject: Project) {
  const [past, setPast] = useState<Project[]>([]);
  const [present, setPresent] = useState<Project>(initialProject);
  const [future, setFuture] = useState<Project[]>([]);

  const commit = useCallback((newProject: Project) => {
    setPast(p => [...p, present]);
    setPresent(newProject);
    setFuture([]);
  }, [present]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast(past.slice(0, past.length - 1));
    setFuture(f => [present, ...f]);
    setPresent(previous);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setPast(p => [...p, present]);
    setFuture(future.slice(1));
    setPresent(next);
  }, [future, present]);

  const jumpToPast = useCallback((steps: number) => {
    if (steps <= 0 || steps > past.length) return;
    const newPast = past.slice(0, past.length - steps);
    const newFuture = [...past.slice(past.length - steps + 1), present, ...future];
    const previous = past[past.length - steps];
    setPast(newPast);
    setFuture(newFuture);
    setPresent(previous);
  }, [past, present, future]);

  const jumpToFuture = useCallback((steps: number) => {
    if (steps <= 0 || steps > future.length) return;
    const next = future[steps - 1];
    const newPast = [...past, present, ...future.slice(0, steps - 1)];
    const newFuture = future.slice(steps);
    setPast(newPast);
    setFuture(newFuture);
    setPresent(next);
  }, [past, present, future]);

  return { 
    present, commit, undo, redo, 
    canUndo: past.length > 0, canRedo: future.length > 0, 
    pastLength: past.length, futureLength: future.length,
    jumpToPast, jumpToFuture, setPresent 
  };
}

export const App: React.FC = () => {
  const getInitialProject = () => {
    const backup = ProjectManager.getAutoSave();
    if (backup) {
      return backup;
    }
    return createDefaultProject();
  };

  const { 
    present: project, commit, undo, redo, canUndo, canRedo, 
    pastLength, futureLength, jumpToPast, jumpToFuture, setPresent 
  } = useProjectHistory(getInitialProject());
  
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, scale: 1 });
  const [tool, setTool] = useState<Tool>('select');
  
  // Support multi-select features
  const [selectedFeatureIds, setSelectedFeatureIds] = useState<string[]>([]);
  const selectedFeatureId = selectedFeatureIds[0] || null;

  const [activeLayerId, setActiveLayerId] = useState<string>(project.layers[0]?.id || '');
  const [cursorWorld, setCursorWorld] = useState<Point | null>(null);
  const [draft, setDraft] = useState<DraftState>(null);
  const [activeRibbonTab, setActiveRibbonTab] = useState('Home');
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1000, height: 700 });
  const [clipboard, setClipboard] = useState<Feature[]>([]);

  // Auto-save effect — save immediately on every project change
  useEffect(() => {
    if (!project.settings.autoSave) return;
    ProjectManager.autoSave(project);
  }, [project]);

  // Also save on browser refresh/close
  useEffect(() => {
    const handleBeforeUnload = () => {
      ProjectManager.autoSave(project);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [project]);



  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); ProjectManager.saveToFile(project); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); handleNewProject(); }
      if (e.ctrlKey && e.key === 'o') { e.preventDefault(); handleOpenProject(); }
      if (e.key === 'Delete' && selectedFeatureIds.length > 0) { e.preventDefault(); handleDeleteFeature(selectedFeatureIds); }
      if (e.ctrlKey && e.key === 'c') { e.preventDefault(); handleCopy(); }
      if (e.ctrlKey && e.key === 'v') { e.preventDefault(); handlePaste(); }
      if (e.ctrlKey && e.key === 'd' && selectedFeatureId) { e.preventDefault(); handleDuplicateFeature(selectedFeatureId); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, project, selectedFeatureIds, clipboard, activeLayerId]);

  // --- Project Operations ---
  const handleNewProject = () => {
    if (window.confirm("Discard current project and start new?")) {
      const newProj = createDefaultProject();
      setPresent(newProj);
      setActiveLayerId(newProj.layers[0]?.id || '');
      setSelectedFeatureIds([]);
      setDraft(null);
    }
  };

  const handleSaveToBrowser = () => {
    ProjectManager.saveToHistory(project);
    alert(`Project "${project.name || "Unnamed Project"}" successfully saved to browser history!`);
  };

  const handleLoadProjectFromHistory = (id: string) => {
    const loaded = ProjectManager.loadFromHistory(id);
    if (loaded) {
      setPresent(loaded);
      setActiveLayerId(loaded.layers[0]?.id || '');
      setSelectedFeatureIds([]);
      setDraft(null);
    }
  };

  const handleInsertCustomImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png, image/jpeg, image/jpg';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (re) => {
        const base64 = re.target?.result as string;
        const img = new Image();
        img.src = base64;
        img.onload = () => {
          const w = img.naturalWidth || 200;
          const h = img.naturalHeight || 200;

          // Scale image to a reasonable size in CAD units
          const maxDim = 150;
          const scaleFactor = Math.min(maxDim / w, maxDim / h);
          const width = w * scaleFactor;
          const height = h * scaleFactor;

          const newF: Feature = {
            id: createId('feature'),
            layerId: activeLayerId,
            name: `Image: ${file.name}`,
            geometry: {
              type: 'image',
              origin: { x: viewport.x - width / 2, y: viewport.y - height / 2 },
              width,
              height,
              src: base64
            },
            style: { fillOpacity: 1 },
            properties: { notes: 'Imported raster image.' },
            createdAt: nowIso(),
            updatedAt: nowIso(),
            zIndex: 2,
            rotation: 0,
            scale: 1
          };

          commit({
            ...project,
            features: [...project.features, newF],
            updatedAt: nowIso()
          });
          setSelectedFeatureIds([newF.id]);
        };
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleInsertClipart = (clipartKey: string) => {
    const src = CLIPARTS[clipartKey];
    if (!src) return;

    const width = 80;
    const height = clipartKey === 'scale' ? 30 : 80;

    const newF: Feature = {
      id: createId('feature'),
      layerId: activeLayerId,
      name: `Clipart: ${clipartKey}`,
      geometry: {
        type: 'image',
        origin: { x: viewport.x - width / 2, y: viewport.y - height / 2 },
        width,
        height,
        src
      },
      style: { fillOpacity: 1 },
      properties: { notes: `Clipart element: ${clipartKey}` },
      createdAt: nowIso(),
      updatedAt: nowIso(),
      zIndex: 3,
      rotation: 0,
      scale: 1
    };

    commit({
      ...project,
      features: [...project.features, newF],
      updatedAt: nowIso()
    });
    setSelectedFeatureIds([newF.id]);
  };

  const handleExit = () => {
    const saveBeforeExit = window.confirm(
      "Do you want to save your project before exiting?\n\n- Click OK to Save to browser history and close.\n- Click Cancel to continue editing."
    );
    if (saveBeforeExit) {
      ProjectManager.saveToHistory(project);
      
      const newProj = createDefaultProject();
      setPresent(newProj);
      setActiveLayerId(newProj.layers[0]?.id || '');
      setSelectedFeatureIds([]);
      setDraft(null);
      ProjectManager.clearAutoSave();
    }
  };

  const handleOpenProject = async () => {
    const result = await ProjectManager.openFromFile(activeLayerId);
    if (!result) return;

    if (result.type === 'project') {
      setPresent(result.project);
      setActiveLayerId(result.project.layers[0]?.id || '');
      setSelectedFeatureIds([]);
      setDraft(null);
    } else if (result.type === 'features') {
      let scanLayerId = activeLayerId;
      const scanLayerName = "Scanned Elements";
      let existingLayer = project.layers.find(l => l.name === scanLayerName);
      
      if (!existingLayer) {
        scanLayerId = createId('layer');
        commit({
          ...project,
          layers: [...project.layers, { 
            id: scanLayerId, 
            name: scanLayerName, 
            visible: true, 
            locked: false, 
            opacity: 1, 
            color: '#10b981', 
            lineWidth: 2, 
            lineStyle: 'solid', 
            order: project.layers.length, 
            kind: 'vector' 
          }],
          features: [...project.features, ...result.features.map(f => ({ ...f, layerId: scanLayerId }))],
          updatedAt: nowIso()
        });
      } else {
        scanLayerId = existingLayer.id;
        commit({
          ...project,
          features: [...project.features, ...result.features.map(f => ({ ...f, layerId: scanLayerId }))],
          updatedAt: nowIso()
        });
      }
      
      setActiveLayerId(scanLayerId);
      setSelectedFeatureIds(result.features.map(f => f.id));
      alert(`Scanned successfully! Imported ${result.features.length} editable vector elements into the "${scanLayerName}" layer.`);
    }
  };

  const handleSave = () => ProjectManager.saveToFile(project);
  const handleSaveAs = () => ProjectManager.saveToFile(project);

  const handleProjectNameChange = (name: string) => {
    commit({ ...project, name, updatedAt: nowIso() });
  };

  const handleDeleteAll = () => {
    if (window.confirm("⚠️ Are you sure you want to delete ALL elements inside the map? This will clear the canvas!")) {
      commit({
        ...project,
        features: [],
        updatedAt: nowIso()
      });
      setSelectedFeatureIds([]);
    }
  };

  // --- Copy / Paste / Duplicate ---
  const handleCopy = () => {
    const selected = project.features.filter(f => selectedFeatureIds.includes(f.id));
    if (selected.length > 0) {
      setClipboard(selected);
    }
  };

  const handlePaste = () => {
    if (clipboard.length === 0) return;
    const pasted = clipboard.map(f => {
      const newF = {
        ...f,
        id: createId('feature'),
        layerId: activeLayerId,
        name: `${f.name} (copy)`,
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      if (newF.geometry.type === 'polygon' || newF.geometry.type === 'polyline') {
        newF.geometry = { ...newF.geometry, points: newF.geometry.points.map(p => ({ x: p.x + 20, y: p.y + 20 })) };
      } else if (newF.geometry.type === 'rectangle') {
        newF.geometry = { ...newF.geometry, origin: { x: newF.geometry.origin.x + 20, y: newF.geometry.origin.y + 20 } };
      } else if (newF.geometry.type === 'circle') {
        newF.geometry = { ...newF.geometry, center: { x: newF.geometry.center.x + 20, y: newF.geometry.center.y + 20 } };
      } else if (newF.geometry.type === 'point' || newF.geometry.type === 'label' || newF.geometry.type === 'symbol') {
        newF.geometry = { ...newF.geometry, point: { x: newF.geometry.point.x + 20, y: newF.geometry.point.y + 20 } };
      }
      return newF;
    });
    commit({
      ...project,
      features: [...project.features, ...pasted],
      updatedAt: nowIso()
    });
    setSelectedFeatureIds(pasted.map(p => p.id));
  };

  // --- Feature Operations ---
  const handleCommitFeature = (f: Feature) => {
    commit({ ...project, features: [...project.features, f], updatedAt: nowIso() });
    setSelectedFeatureIds([f.id]);
  };

  const handleUpdateFeature = (id: string, updater: (f: Feature) => Feature) => {
    commit({ ...project, features: project.features.map(f => f.id === id ? updater(f) : f), updatedAt: nowIso() });
  };

  const handleDeleteFeature = (ids: string | string[]) => {
    const deleteIds = Array.isArray(ids) ? ids : [ids];
    commit({ ...project, features: project.features.filter(f => !deleteIds.includes(f.id)), updatedAt: nowIso() });
    setSelectedFeatureIds([]);
  };

  const handleDuplicateFeature = (id: string) => {
    const f = project.features.find(f => f.id === id);
    if (!f) return;
    const newF = { ...f, id: createId('feature'), name: `${f.name} (copy)`, zIndex: Math.max(...project.features.map(f=>f.zIndex), 0) + 1 };
    
    if (newF.geometry.type === 'polygon' || newF.geometry.type === 'polyline') {
      newF.geometry = { ...newF.geometry, points: newF.geometry.points.map(p => ({ x: p.x + 20, y: p.y + 20 })) };
    } else if (newF.geometry.type === 'rectangle') {
      newF.geometry = { ...newF.geometry, origin: { x: newF.geometry.origin.x + 20, y: newF.geometry.origin.y + 20 } };
    } else if (newF.geometry.type === 'circle') {
      newF.geometry = { ...newF.geometry, center: { x: newF.geometry.center.x + 20, y: newF.geometry.center.y + 20 } };
    } else if (newF.geometry.type === 'point' || newF.geometry.type === 'label' || newF.geometry.type === 'symbol') {
      newF.geometry = { ...newF.geometry, point: { x: newF.geometry.point.x + 20, y: newF.geometry.point.y + 20 } };
    }

    commit({ ...project, features: [...project.features, newF], updatedAt: nowIso() });
    setSelectedFeatureIds([newF.id]);
  };

  const handleBringForward = (id: string) => {
    handleUpdateFeature(id, f => ({ ...f, zIndex: f.zIndex + 1 }));
  };

  const handleSendBackward = (id: string) => {
    handleUpdateFeature(id, f => ({ ...f, zIndex: f.zIndex - 1 }));
  };

  const handleUpdateFeatureProperty = (id: string, key: string, value: any) => {
    handleUpdateFeature(id, f => {
      if (key === 'rotation') return { ...f, rotation: value };
      if (key === 'scale') return { ...f, scale: value };
      if (key === 'text' && f.geometry.type === 'label') {
        return { ...f, geometry: { ...f.geometry, text: value } };
      }
      return { ...f, properties: { ...f.properties, [key]: value } };
    });
  };

  const handleUpdateFeatureStyle = (id: string, style: any) => {
    handleUpdateFeature(id, f => ({ ...f, style: { ...f.style, ...style } }));
  };

  // --- Plot Merge (Join Adjacent) ---
  const handleMergePlots = () => {
    if (selectedFeatureIds.length < 2) return;
    const f1 = project.features.find(f => f.id === selectedFeatureIds[0]);
    const f2 = project.features.find(f => f.id === selectedFeatureIds[1]);
    if (!f1 || !f2) return;

    if (
      (f1.geometry.type === 'polygon' || f1.geometry.type === 'rectangle') &&
      (f2.geometry.type === 'polygon' || f2.geometry.type === 'rectangle')
    ) {
      const p1 = toPolygonPoints(f1.geometry);
      const p2 = toPolygonPoints(f2.geometry);
      const mergedPts = mergeAdjacentPolygons(p1, p2);
      if (mergedPts) {
        const remainingFeatures = project.features.filter(f => f.id !== f1.id && f.id !== f2.id);
        const merged: Feature = {
          id: createId('feature'),
          layerId: f1.layerId,
          name: `${f1.name} + ${f2.name}`,
          zIndex: f1.zIndex,
          geometry: { type: 'polygon', points: mergedPts },
          style: { ...f1.style },
          properties: {
            ...f1.properties,
            plotNumber: `${f1.properties.plotNumber || ''}-${f2.properties.plotNumber || ''}`,
            ownerName: f1.properties.ownerName || f2.properties.ownerName
          },
          createdAt: nowIso(),
          updatedAt: nowIso()
        };
        commit({
          ...project,
          features: [...remainingFeatures, merged],
          updatedAt: nowIso()
        });
        setSelectedFeatureIds([merged.id]);
      } else {
        alert("Adjacent border sharing edge not found. Cannot merge!");
      }
    }
  };

  const handleCommitLayout = (generatedFeatures: Feature[]) => {
    commit({
      ...project,
      features: [...project.features, ...generatedFeatures],
      updatedAt: nowIso()
    });
    // Set viewport to fit the layout center
    setViewport({ x: 150, y: 150, scale: 0.65 });
  };

  // --- Layer Operations ---
  const handleAddLayer = () => {
    const id = createId('layer');
    commit({
      ...project,
      layers: [...project.layers, { id, name: `Layer ${project.layers.length + 1}`, visible: true, locked: false, opacity: 1, color: '#ffffff', lineWidth: 1, lineStyle: 'solid', order: project.layers.length, kind: 'vector' }],
      updatedAt: nowIso()
    });
    setActiveLayerId(id);
  };

  const handleDeleteLayer = (id: string) => {
    if (project.layers.length <= 1) return;
    const newLayers = project.layers.filter(l => l.id !== id);
    commit({
      ...project,
      layers: newLayers,
      features: project.features.filter(f => f.layerId !== id),
      updatedAt: nowIso()
    });
    if (activeLayerId === id) setActiveLayerId(newLayers[0].id);
  };

  const handleDuplicateLayer = (id: string) => {
    const l = project.layers.find(l => l.id === id);
    if (!l) return;
    const newId = createId('layer');
    commit({
      ...project,
      layers: [...project.layers, { ...l, id: newId, name: `${l.name} (copy)`, order: project.layers.length }],
      updatedAt: nowIso()
    });
  };

  const handleUpdateLayer = (id: string, updates: Partial<Layer>) => {
    commit({
      ...project,
      layers: project.layers.map(l => l.id === id ? { ...l, ...updates } : l),
      updatedAt: nowIso()
    });
  };

  const handleReorderLayer = (id: string, direction: 'up' | 'down') => {
    const layers = [...project.layers].sort((a, b) => a.order - b.order);
    const index = layers.findIndex(l => l.id === id);
    if (index < 0) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= layers.length) return;
    [layers[index], layers[swapIndex]] = [layers[swapIndex], layers[index]];
    
    commit({
      ...project,
      layers: layers.map((l, i) => ({ ...l, order: i })),
      updatedAt: nowIso()
    });
  };

  // --- Settings ---
  const handleUpdateSettings = (updates: Partial<ProjectSettings>) => {
    commit({ ...project, settings: { ...project.settings, ...updates }, updatedAt: nowIso() });
  };

  // --- Import / Export ---
  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSVG = () => {
    downloadFile(projectToSvg(project), `${project.name || "project"}.svg`, "image/svg+xml");
  };

  const handleDownloadDXF = () => {
    downloadFile(projectToDxf(project), `${project.name || "project"}.dxf`, "application/dxf");
  };

  const handleDownloadGeoJSON = () => {
    downloadFile(projectToGeoJson(project), `${project.name || "project"}.geojson`, "application/geo+json");
  };

  const handleDownloadCSV = () => {
    downloadFile(projectToCsv(project), `${project.name || "project"}.csv`, "text/csv");
  };

  // Dynamic DXF Reader
  const handleImportDXF = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.dxf';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (re) => {
        const text = re.target?.result as string;
        const importedFeatures = importFromDxf(text);
        if (importedFeatures.length > 0) {
          commit({
            ...project,
            features: [...project.features, ...importedFeatures],
            updatedAt: nowIso()
          });
          setSelectedFeatureIds(importedFeatures.map(f => f.id));
          alert(`Successfully imported ${importedFeatures.length} entities from DXF file!`);
        } else {
          alert("Could not find any readable LINE, CIRCLE, or LWPOLYLINE geometry entities inside DXF!");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const importFromDxf = (dxfString: string): Feature[] => {
    const features: Feature[] = [];
    const lines = dxfString.split(/\r?\n/);
    
    let currentEntity: string | null = null;
    let x1=0, y1=0;
    let x2=0, y2=0;
    let xc=0, yc=0, r=0;
    let polylinePoints: Point[] = [];
    let polylineClosed = false;

    const commitEntity = () => {
      if (!currentEntity) return;
      const id = createId('feature');
      if (currentEntity === 'LINE') {
        features.push({
          id, layerId: activeLayerId, name: 'Import Line', zIndex: 0,
          geometry: { type: 'line', points: [{x: x1, y: y1}, {x: x2, y: y2}] },
          style: {}, properties: {}, createdAt: nowIso(), updatedAt: nowIso()
        });
      } else if (currentEntity === 'CIRCLE') {
        features.push({
          id, layerId: activeLayerId, name: 'Import Circle', zIndex: 0,
          geometry: { type: 'circle', center: {x: xc, y: yc}, radius: r },
          style: {}, properties: {}, createdAt: nowIso(), updatedAt: nowIso()
        });
      } else if (currentEntity === 'LWPOLYLINE') {
        if (polylinePoints.length > 1) {
          features.push({
            id, layerId: activeLayerId, name: polylineClosed ? 'Import Plot' : 'Import Polyline', zIndex: 0,
            geometry: polylineClosed 
              ? { type: 'polygon', points: polylinePoints }
              : { type: 'polyline', points: polylinePoints },
            style: {}, properties: {}, createdAt: nowIso(), updatedAt: nowIso()
          });
        }
      }
      currentEntity = null;
      polylinePoints = [];
      polylineClosed = false;
    };

    for (let i = 0; i < lines.length - 1; i += 2) {
      const code = lines[i].trim();
      const value = lines[i+1].trim();

      if (code === '0') {
        commitEntity();
        if (['LINE', 'CIRCLE', 'LWPOLYLINE'].includes(value)) {
          currentEntity = value;
        }
      } else if (currentEntity) {
        if (code === '10') {
          if (currentEntity === 'CIRCLE') xc = parseFloat(value);
          else if (currentEntity === 'LWPOLYLINE') polylinePoints.push({x: parseFloat(value), y: 0});
          else x1 = parseFloat(value);
        } else if (code === '20') {
          if (currentEntity === 'CIRCLE') yc = parseFloat(value);
          else if (currentEntity === 'LWPOLYLINE' && polylinePoints.length > 0) {
            polylinePoints[polylinePoints.length - 1].y = parseFloat(value);
          }
          else y1 = parseFloat(value);
        } else if (code === '11') {
          x2 = parseFloat(value);
        } else if (code === '21') {
          y2 = parseFloat(value);
        } else if (code === '40') {
          r = parseFloat(value);
        } else if (code === '70') {
          polylineClosed = (parseInt(value) & 1) !== 0;
        }
      }
    }
    commitEntity();
    return features;
  };

  const handleSelectFeature = (id: string | string[] | null) => {
    if (id === null) setSelectedFeatureIds([]);
    else if (Array.isArray(id)) setSelectedFeatureIds(id);
    else setSelectedFeatureIds([id]);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Fullscreen request failed: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const handleToolChange = (newTool: Tool) => {
    if (newTool === 'arrow') {
      const length = 60;
      const start = { x: viewport.x - length / 2, y: viewport.y };
      const end = { x: viewport.x + length / 2, y: viewport.y };
      
      const newF: Feature = {
        id: createId('feature'),
        layerId: activeLayerId,
        name: 'Arrow Indicator 1',
        geometry: {
          type: 'arrow',
          start,
          end,
          headSize: 12
        },
        style: { borderColor: '#ef4444', lineWidth: 3 },
        properties: { notes: 'Arrow pointer symbol.' },
        createdAt: nowIso(),
        updatedAt: nowIso(),
        zIndex: 4,
        rotation: 0,
        scale: 1
      };
      
      commit({
        ...project,
        features: [...project.features, newF],
        updatedAt: nowIso()
      });
      setSelectedFeatureIds([newF.id]);
      setTool('select');
      return;
    }
    setTool(newTool);
  };

  const handleFitAll = () => {
    if (project.features.length === 0) {
      setViewport({ x: 0, y: 0, scale: 1 });
      return;
    }

    // Select ALL features — highlight everything
    setSelectedFeatureIds(project.features.map(f => f.id));

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    project.features.forEach(f => {
      const b = geometryBounds(f.geometry);
      if (b.minX < minX) minX = b.minX;
      if (b.minY < minY) minY = b.minY;
      if (b.maxX > maxX) maxX = b.maxX;
      if (b.maxY > maxY) maxY = b.maxY;
    });

    if (minX !== Infinity && maxX !== -Infinity) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      
      const pad = 80;
      const fitW = Math.max(50, maxX - minX + pad * 2);
      const fitH = Math.max(50, maxY - minY + pad * 2);
      
      const scX = canvasSize.width / fitW;
      const scY = canvasSize.height / fitH;
      let scale = Math.min(scX, scY);
      scale = Math.min(Math.max(scale, 0.05), 40);

      setViewport({ x: centerX, y: centerY, scale });
    } else {
      setViewport({ x: 0, y: 0, scale: 1 });
    }
  };

  const handleCenterView = () => {
    setViewport({ x: 0, y: 0, scale: 1 });
  };

  const handleExportCropArea = (bounds: { minX: number; maxX: number; minY: number; maxY: number }) => {
    const formatChoice = window.prompt(
      "Choose Download Format for Selected Area:\n\n" +
      "Type '1' to download as PNG Image\n" +
      "Type '2' to download as JPEG Image\n" +
      "Type '3' to download as PDF Document\n\n" +
      "Enter option number (1, 2, or 3):",
      "1"
    );

    if (!formatChoice) return;

    const width = 8192;
    const height = 6144;
    const isPNG = formatChoice === '1';
    const isJPEG = formatChoice === '2';
    const isPDF = formatChoice === '3';

    if (isPNG) {
      renderProjectToOffscreenCanvas(project, width, height, project.settings.showGrid, true, undefined, false, bounds).then(offscreen => {
        const link = document.createElement("a");
        link.download = `${project.name}_crop.png`;
        link.href = offscreen.toDataURL("image/png");
        link.click();
      });
    } else if (isJPEG) {
      renderProjectToOffscreenCanvas(project, width, height, project.settings.showGrid, true, undefined, false, bounds).then(offscreen => {
        const link = document.createElement("a");
        link.download = `${project.name}_crop.jpg`;
        link.href = offscreen.toDataURL("image/jpeg", 0.95);
        link.click();
      });
    } else if (isPDF) {
      if (canvasRef) {
        exportToPDF(project, canvasRef, {
          paperSize: 'A4', orientation: 'landscape', scale: 100, fitToPage: true, showGrid: false, showDimensions: true, title: `${project.name}_crop`
        }, undefined, bounds);
      }
    }
    
    setTool('select');
  };

  const getViewportBounds = () => {
    const halfW = canvasSize.width / 2 / viewport.scale;
    const halfH = canvasSize.height / 2 / viewport.scale;
    return {
      minX: viewport.x - halfW,
      maxX: viewport.x + halfW,
      minY: viewport.y - halfH,
      maxY: viewport.y + halfH
    };
  };

  return (
    <div className="app-shell">
      <RibbonMenu 
        activeTab={activeRibbonTab} 
        onTabChange={setActiveRibbonTab} 
        projectName={project.name}
        onProjectNameChange={handleProjectNameChange}
        onNewProject={handleNewProject}
        onOpenProject={handleOpenProject}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onSaveToBrowser={handleSaveToBrowser}
        onOpenHistory={() => setShowHistoryDialog(true)}
        onExit={handleExit}
        onInsertCustomImage={handleInsertCustomImage}
        onInsertClipart={handleInsertClipart}
        onFitAll={handleFitAll}
        onCenterView={handleCenterView}
        onUndo={undo}
        onRedo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onExportPNG={() => exportToPNG(project, project.name, selectedFeatureIds, getViewportBounds())}
        onExportJPEG={() => exportToJPEG(project, project.name, selectedFeatureIds, getViewportBounds())}
        onExportPDF={() => canvasRef && exportToPDF(project, canvasRef, {
          paperSize: 'A4', orientation: 'landscape', scale: 100, fitToPage: true, showGrid: false, showDimensions: true, title: project.name
        }, selectedFeatureIds, getViewportBounds())}
        onExportSVG={handleDownloadSVG}
        onExportDXF={handleDownloadDXF}
        onExportGeoJSON={handleDownloadGeoJSON}
        onExportCSV={handleDownloadCSV}
        onPrint={() => setShowPrintDialog(true)}
        onMerge={handleMergePlots}
        canMerge={selectedFeatureIds.length >= 2}
        onDeleteAll={handleDeleteAll}
        onOpenAIGenerator={() => setShowAIGenerator(true)}
        onToggleFullscreen={handleToggleFullscreen}
        bgColor={project.settings.backgroundColor || '#0a0f1e'}
        onBgColorChange={(color: string) => commit({
          ...project,
          settings: { ...project.settings, backgroundColor: color },
          updatedAt: nowIso()
        })}
      />
      <Toolbar tool={tool} onToolChange={handleToolChange} scale={viewport.scale} />
      
      <main className="workspace">
        <aside className="left-sidebar">
          <LayerPanel 
            layers={project.layers} 
            features={project.features}
            activeLayerId={activeLayerId}
            onSelectLayer={setActiveLayerId}
            onAddLayer={handleAddLayer}
            onDeleteLayer={handleDeleteLayer}
            onDuplicateLayer={handleDuplicateLayer}
            onToggleLayerVisible={id => handleUpdateLayer(id, { visible: !project.layers.find(l=>l.id===id)?.visible })}
            onToggleLayerLock={id => handleUpdateLayer(id, { locked: !project.layers.find(l=>l.id===id)?.locked })}
            onRenameLayer={(id, name) => handleUpdateLayer(id, { name })}
            onChangeLayerColor={(id, color) => handleUpdateLayer(id, { color })}
            onChangeLayerOpacity={(id, opacity) => handleUpdateLayer(id, { opacity })}
            onReorderLayer={handleReorderLayer}
          />
          <ObjectPanel 
            layers={project.layers}
            features={project.features}
            selectedFeatureId={selectedFeatureId}
            onSelectFeature={(id) => {
              handleSelectFeature(id);
              if (id && !Array.isArray(id)) {
                const f = project.features.find(feat => feat.id === id);
                if (f) {
                  const center = featureCenter(f);
                  setViewport(v => ({
                    ...v,
                    x: center.x,
                    y: center.y
                  }));
                }
              }
            }}
          />
          <div style={{ padding: '0.75rem' }}>
            <button className="ribbon-btn ribbon-btn-primary" style={{ width: '100%', padding: '8px' }} onClick={handleImportDXF}>
              📥 Import DXF CAD File
            </button>
          </div>
        </aside>

        <CanvasStage 
          layers={project.layers}
          features={project.features}
          viewport={viewport}
          tool={tool}
          activeLayerId={activeLayerId}
          selectedFeatureId={selectedFeatureId}
          selectedFeatureIds={selectedFeatureIds}
          draft={draft}
          settings={project.settings}
          onViewportChange={setViewport}
          onSelectFeature={handleSelectFeature}
          onCommitFeature={handleCommitFeature}
          onUpdateFeature={handleUpdateFeature}
          onCursorMove={setCursorWorld}
          onDraftChange={setDraft}
          onFinishDraft={() => {
             setDraft(null);
          }}
          onCancelDraft={() => {
             setDraft(null);
          }}
          onCanvasReady={(canvas) => {
            setCanvasRef(canvas);
            if (canvas) {
              setCanvasSize({ width: canvas.width, height: canvas.height });
            }
          }}
          onExportCropArea={handleExportCropArea}
        />

        <aside className="right-sidebar">
          <MiniMap 
            features={project.features}
            layers={project.layers}
            viewport={viewport}
            canvasWidth={canvasSize.width}
            canvasHeight={canvasSize.height}
            onViewportChange={setViewport}
          />
          <HistoryPanel 
            past={pastLength}
            future={futureLength}
            onJumpToPast={jumpToPast}
            onJumpToFuture={jumpToFuture}
          />
          <PropertiesPanel 
            feature={project.features.find(f => f.id === selectedFeatureId) || null}
            settings={project.settings}
            onUpdateProperty={handleUpdateFeatureProperty}
            onUpdateStyle={handleUpdateFeatureStyle}
            onDeleteFeature={handleDeleteFeature}
            onDuplicateFeature={handleDuplicateFeature}
            onBringForward={handleBringForward}
            onSendBackward={handleSendBackward}
            onCommitFeature={handleCommitFeature}
          />
        </aside>
      </main>

      <StatusBar 
        tool={tool}
        viewport={viewport}
        cursorWorld={cursorWorld}
        settings={project.settings}
        selectedCount={selectedFeatureIds.length}
        featureCount={project.features.length}
        onZoomChange={(scale) => setViewport(v => ({ ...v, scale }))}
        onUnitChange={(unit) => handleUpdateSettings({ units: unit })}
        snapModes={project.settings.snapModes}
        onToggleSnap={(mode) => {
          const current = project.settings.snapModes;
          const next = current.includes(mode) ? current.filter(m => m !== mode) : [...current, mode];
          handleUpdateSettings({ snapModes: next });
        }}
      />

      {showPrintDialog && (
        <PrintDialog 
          open={showPrintDialog}
          projectName={project.name}
          onClose={() => setShowPrintDialog(false)}
          onPrint={(printSettings) => {
             setShowPrintDialog(false);
             if (canvasRef) {
                exportToPDF(project, canvasRef, printSettings, selectedFeatureIds, getViewportBounds());
             }
          }}
        />
      )}

      {showAIGenerator && (
        <AILayoutGenerator 
          open={showAIGenerator}
          onClose={() => setShowAIGenerator(false)}
          onCommitLayout={handleCommitLayout}
          layers={project.layers}
        />
      )}

      {showHistoryDialog && (
        <HistoryDialog
          open={showHistoryDialog}
          onClose={() => setShowHistoryDialog(false)}
          onLoadProject={handleLoadProjectFromHistory}
          currentProjectId={project.id}
        />
      )}
    </div>
  );
};
