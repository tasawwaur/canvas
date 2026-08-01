import type { Project, RecentFile, SavedProjectInfo, Feature } from "../types";
import { traceImageToFeatures, renderPdfToCanvas } from "../lib/vectorizer";

export class ProjectManager {
  static saveToFile(project: Project): void {
    const json = JSON.stringify(project, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project.name || "project"}.lmp`;
    link.click();
    URL.revokeObjectURL(url);
  }

  static async openFromFile(layerId: string): Promise<{ type: "project"; project: Project } | { type: "features"; features: Feature[] } | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".lmp,.json,.png,.jpg,.jpeg,.pdf";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        const name = file.name.toLowerCase();
        if (name.endsWith(".png") || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
          try {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
              const canvas = document.createElement("canvas");
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                const features = traceImageToFeatures(canvas, layerId);
                URL.revokeObjectURL(img.src);
                resolve({ type: "features", features });
              } else {
                URL.revokeObjectURL(img.src);
                resolve(null);
              }
            };
            img.onerror = () => {
              URL.revokeObjectURL(img.src);
              resolve(null);
            };
          } catch (err) {
            console.error("Failed to trace image", err);
            resolve(null);
          }
        } else if (name.endsWith(".pdf")) {
          try {
            const canvas = await renderPdfToCanvas(file);
            if (canvas) {
              const features = traceImageToFeatures(canvas, layerId);
              resolve({ type: "features", features });
            } else {
              resolve(null);
            }
          } catch (err) {
            console.error("Failed to trace PDF", err);
            resolve(null);
          }
        } else {
          const reader = new FileReader();
          reader.onload = (re) => {
            try {
              const project = JSON.parse(re.target?.result as string) as Project;
              resolve({ type: "project", project });
            } catch (err) {
              console.error("Failed to parse project file", err);
              resolve(null);
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    });
  }

  static autoSave(project: Project): void {
    try {
      localStorage.setItem("lmp_autosave", JSON.stringify(project));
    } catch (err) {
      console.warn("Failed to auto-save project", err);
    }
  }

  static getAutoSave(): Project | null {
    try {
      const data = localStorage.getItem("lmp_autosave");
      if (data) {
        return JSON.parse(data) as Project;
      }
    } catch (err) {
      console.warn("Failed to load auto-save", err);
    }
    return null;
  }

  static clearAutoSave(): void {
    localStorage.removeItem("lmp_autosave");
  }

  static addRecentFile(name: string): void {
    try {
      const recents = this.getRecentFiles();
      const filtered = recents.filter(r => r.name !== name);
      filtered.unshift({
        name,
        path: "", 
        lastOpened: new Date().toISOString()
      });
      const limited = filtered.slice(0, 10);
      localStorage.setItem("lmp_recent_files", JSON.stringify(limited));
    } catch (err) {
      console.warn("Failed to add recent file", err);
    }
  }

  static getRecentFiles(): RecentFile[] {
    try {
      const data = localStorage.getItem("lmp_recent_files");
      if (data) {
        return JSON.parse(data) as RecentFile[];
      }
    } catch (err) {
      console.warn("Failed to get recent files", err);
    }
    return [];
  }

  static hasRecoverableBackup(): boolean {
    return !!localStorage.getItem("lmp_autosave");
  }

  static recoverBackup(): Project | null {
    return this.getAutoSave();
  }

  // --- Local Browser History DB Functions ---
  static saveToHistory(project: Project): void {
    try {
      localStorage.setItem(`lmp_project_${project.id}`, JSON.stringify(project));
      
      const list = this.getHistoryList();
      const filtered = list.filter(p => p.id !== project.id);
      filtered.unshift({
        id: project.id,
        name: project.name || "Unnamed Project",
        updatedAt: project.updatedAt || new Date().toISOString(),
        featureCount: project.features.length
      });
      localStorage.setItem("lmp_project_list", JSON.stringify(filtered));
    } catch (err) {
      console.warn("Failed to save project to history", err);
    }
  }

  static getHistoryList(): SavedProjectInfo[] {
    try {
      const data = localStorage.getItem("lmp_project_list");
      if (data) {
        return JSON.parse(data) as SavedProjectInfo[];
      }
    } catch (err) {
      console.warn("Failed to get project history list", err);
    }
    return [];
  }

  static loadFromHistory(id: string): Project | null {
    try {
      const data = localStorage.getItem(`lmp_project_${id}`);
      if (data) {
        return JSON.parse(data) as Project;
      }
    } catch (err) {
      console.warn("Failed to load project from history", err);
    }
    return null;
  }

  static deleteFromHistory(id: string): void {
    try {
      localStorage.removeItem(`lmp_project_${id}`);
      const list = this.getHistoryList();
      const filtered = list.filter(p => p.id !== id);
      localStorage.setItem("lmp_project_list", JSON.stringify(filtered));
    } catch (err) {
      console.warn("Failed to delete project from history", err);
    }
  }
}
