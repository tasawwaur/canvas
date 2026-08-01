import React from 'react';

type RibbonMenuProps = {
  activeTab: string;
  onTabChange: (tab: string) => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onExportPNG: () => void;
  onExportJPEG: () => void;
  onExportPDF: () => void;
  onExportSVG: () => void;
  onExportDXF: () => void;
  onExportGeoJSON: () => void;
  onExportCSV: () => void;
  onPrint: () => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  onMerge?: () => void;
  canMerge?: boolean;
  onDeleteAll?: () => void;
  onOpenAIGenerator?: () => void;
  onToggleFullscreen?: () => void;
  onSaveToBrowser?: () => void;
  onOpenHistory?: () => void;
  onExit?: () => void;
  onInsertCustomImage?: () => void;
  onInsertClipart?: (clipartKey: string) => void;
  onFitAll?: () => void;
  onCenterView?: () => void;
  bgColor?: string;
  onBgColorChange?: (color: string) => void;
};

export const RibbonMenu: React.FC<RibbonMenuProps> = ({
  activeTab,
  onTabChange,
  onNewProject,
  onOpenProject,
  onSave,
  onSaveAs,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onExportPNG,
  onExportJPEG,
  onExportPDF,
  onExportSVG,
  onExportDXF,
  onExportGeoJSON,
  onExportCSV,
  onPrint,
  projectName,
  onProjectNameChange,
  onMerge,
  canMerge = false,
  onDeleteAll,
  onOpenAIGenerator,
  onToggleFullscreen,
  onSaveToBrowser,
  onOpenHistory,
  onExit,
  onInsertCustomImage,
  onInsertClipart,
  onFitAll,
  onCenterView,
  bgColor,
  onBgColorChange,
}) => {
  const tabs = ['File', 'Home', 'View', 'Export'];
  const tabLabels: Record<string, string> = {
    File: '📁 File',
    Home: '🏠 Home',
    View: '👁️ View',
    Export: '📤 Export'
  };

  return (
    <header className="ribbon">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div className="ribbon-brand" style={{ padding: 0, fontWeight: 700, letterSpacing: '0.5px' }}>🏙️ LAND MAPPING PRO</div>
          <nav className="ribbon-tabs" style={{ padding: 0 }}>
            {tabs.map((tab) => (
              <button
                key={tab}
                className={`ribbon-tab ${activeTab === tab ? 'ribbon-tab-active' : ''}`}
                onClick={() => onTabChange(tab)}
              >
                {tabLabels[tab]}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="text"
            className="ribbon-project-name"
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid var(--border-color)', 
              borderRadius: '6px', 
              padding: '4px 10px', 
              fontSize: '13px',
              width: '180px',
              marginRight: '220px' // Leave space for timer & logout
            }}
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="Project Name"
          />
        </div>
      </div>

      <div className="ribbon-content">
        {activeTab === 'File' && (
          <div className="ribbon-group">
            <button className="ribbon-btn ribbon-btn-primary" onClick={onNewProject}>📄 New</button>
            <button className="ribbon-btn" onClick={onOpenProject}>📂 Open</button>
            <button className="ribbon-btn" onClick={onSave}>💾 Save File</button>
            {onSaveToBrowser && (
              <button className="ribbon-btn" onClick={onSaveToBrowser} style={{ border: '1px solid #14b8a6' }}>💾 Save to Browser</button>
            )}
            {onOpenHistory && (
              <button className="ribbon-btn" onClick={onOpenHistory}>📁 Recent</button>
            )}
            <span className="ribbon-group-title">File</span>
          </div>
        )}

        {activeTab === 'Home' && (
          <>
            <div className="ribbon-group">
              <button className="ribbon-btn" onClick={onUndo} disabled={!canUndo}>↩️ Undo</button>
              <button className="ribbon-btn" onClick={onRedo} disabled={!canRedo}>↪️ Redo</button>
              <button className="ribbon-btn" style={{ color: '#ef4444' }} onClick={onDeleteAll}>🗑️ Delete All</button>
              {onFitAll && (
                <button className="ribbon-btn" onClick={onFitAll} style={{ color: '#10b981', fontWeight: 600 }}>🔎 Fit Project</button>
              )}
              {onMerge && (
                <button className="ribbon-btn" onClick={onMerge} disabled={!canMerge} style={{ border: '1px solid #fb923c' }}>
                  🔗 Merge Plots
                </button>
              )}
              {onOpenAIGenerator && (
                <button className="ribbon-btn ribbon-btn-primary" onClick={onOpenAIGenerator} style={{ background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)', color: '#fff', border: 'none', fontWeight: 600 }}>
                  🤖 AI Layout
                </button>
              )}
              <span className="ribbon-group-title">Clipboard & Edit</span>
            </div>
            
            {(onInsertCustomImage || onInsertClipart) && (
              <div className="ribbon-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {onInsertCustomImage && (
                  <button className="ribbon-btn ribbon-btn-primary" onClick={onInsertCustomImage} style={{ background: 'var(--accent-primary)', color: '#000', fontWeight: 600 }}>
                    🖼️ Insert Photo
                  </button>
                )}
                {onInsertClipart && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="ribbon-btn" title="North Arrow" onClick={() => onInsertClipart('north_arrow')}>🧭 North</button>
                    <button className="ribbon-btn" title="CAD Tree" onClick={() => onInsertClipart('tree')}>🌳 Tree</button>
                    <button className="ribbon-btn" title="CAD Car" onClick={() => onInsertClipart('car')}>🚗 Car</button>
                    <button className="ribbon-btn" title="Scale Bar" onClick={() => onInsertClipart('scale')}>📏 Scale</button>
                  </div>
                )}
                <span className="ribbon-group-title">Gallery</span>
              </div>
            )}
          </>
        )}

        {activeTab === 'View' && (
          <>
            <div className="ribbon-group">
              <button className="ribbon-btn" onClick={onCenterView}>🔍 Center View</button>
              <button className="ribbon-btn" onClick={onFitAll}>🔎 Fit All</button>
              <button className="ribbon-btn">🌐 Grid</button>
              <button className="ribbon-btn">📐 Dimensions</button>
              <button className="ribbon-btn">🧲 Snap</button>
              {onToggleFullscreen && (
                <button className="ribbon-btn" onClick={onToggleFullscreen} style={{ color: '#0ea5e9', fontWeight: 600 }}>
                  🖥️ Fullscreen
                </button>
              )}
              <span className="ribbon-group-title">View Options</span>
            </div>
            {onBgColorChange && (
              <div className="ribbon-group" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>🎨 Background:</span>
                {['#0a0f1e','#1e293b','#0f172a','#18181b','#ffffff','#f8fafc','#fef3c7','#d1fae5','#e0e7ff','#fce7f3'].map((c) => (
                  <div
                    key={c}
                    onClick={() => onBgColorChange && onBgColorChange(c)}
                    style={{
                      width: '22px', height: '22px',
                      background: c,
                      border: bgColor === c ? '2px solid #0ea5e9' : '1px solid #475569',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      boxShadow: bgColor === c ? '0 0 6px #0ea5e9' : 'none',
                    }}
                  />
                ))}
                <input
                  type="color"
                  value={bgColor || '#0a0f1e'}
                  onChange={e => onBgColorChange && onBgColorChange(e.target.value)}
                  title="Custom Color"
                  style={{ width: '28px', height: '22px', border: 'none', padding: 0, cursor: 'pointer', background: 'transparent' }}
                />
                <span className="ribbon-group-title">Map Background</span>
              </div>
            )}
          </>
        )}

        {activeTab === 'Export' && (
          <div className="ribbon-group">
            <button className="ribbon-btn" onClick={onExportPNG}>🖼️ PNG</button>
            <button className="ribbon-btn" onClick={onExportJPEG}>📸 JPEG</button>
            <button className="ribbon-btn" onClick={onExportPDF}>📄 PDF</button>
            <button className="ribbon-btn" onClick={onExportSVG}>🎨 SVG</button>
            <button className="ribbon-btn" onClick={onExportDXF}>📐 DXF</button>
            <button className="ribbon-btn" onClick={onExportGeoJSON}>🗺️ GeoJSON</button>
            <button className="ribbon-btn" onClick={onExportCSV}>📊 CSV</button>
            <button className="ribbon-btn ribbon-btn-primary" onClick={onPrint}>🖨️ Print</button>
            <span className="ribbon-group-title">Export & Print</span>
          </div>
        )}
      </div>
    </header>
  );
};
