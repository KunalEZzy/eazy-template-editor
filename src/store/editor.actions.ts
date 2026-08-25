import type { Template } from "../domain/template/template.types";
import type { EditorPanel } from "./editor.types";

export interface EditorActions {
  setTemplate: (template: Template) => void;

  selectBox: (boxId: string | null) => void;

  setZoom: (zoom: number) => void;

  setPan: (x: number, y: number) => void;

  setActivePanel: (panel: EditorPanel) => void;

  markDirty: () => void;

  markClean: () => void;

  setLoading: (loading: boolean) => void;

  setSaving: (saving: boolean) => void;

  setError: (error: string | null) => void;

  resetEditor: () => void;
}