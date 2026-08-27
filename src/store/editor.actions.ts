import type { TextBox } from "../domain/box/box.types";
import type { Template } from "../domain/template/template.types";
import type { EditorPanel } from "./editor.types";

export interface EditorActions {
  setTemplate: (
    template: Template
  ) => void;

  selectBox: (
    boxId: string | null
  ) => void;

  updateTextBox: (
    boxId: string,
    changes: Partial<
      Omit<TextBox, "id" | "type">
    >
  ) => void;

  updateBoxTransform: (
    boxId: string,
    changes: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
    }
  ) => void;

  setZoom: (
    zoom: number
  ) => void;

  setPan: (
    x: number,
    y: number
  ) => void;

  setActivePanel: (
    panel: EditorPanel
  ) => void;

  markDirty: () => void;

  markClean: () => void;

  setLoading: (
    loading: boolean
  ) => void;

  setSaving: (
    saving: boolean
  ) => void;

  setError: (
    error: string | null
  ) => void;

  resetEditor: () => void;
}