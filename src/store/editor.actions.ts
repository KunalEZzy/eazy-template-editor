import type { QRBox, TextBox } from "../domain/box/box.types";
import type { Template, CampaignType } from "../domain/template/template.types";
import type { EditorPanel, EditorRuntimeMode } from "./editor.types";
import type { TextVariable, QRVariable } from "../domain/variables/variables.types";
import type { PreviewData } from "../domain/variables/preview.types";

export interface EditorActions {
  setTemplate: (template: Template) => void;

  setInitialized: (initialized: boolean) => void;

  setPreviewData: (previewData: PreviewData) => void;

  updateTemplateInfo: (info: {
    name?: string;
    campaign?: CampaignType;
    active?: boolean;
  }) => void;

  setCreator: (creator: string) => void;

  setEditorMode: (mode: EditorRuntimeMode) => void;

  selectBox: (boxId: string | null) => void;

  updateTextBox: (
    boxId: string,
    changes: Partial<Omit<TextBox, "id" | "type">>
  ) => void;

  setTemporaryBackgroundImage: (
    imageUrl: string | null,
    dimensions?: { width: number; height: number }
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

  updateQRBox: (
    boxId: string,
    changes: Partial<Omit<QRBox, "id" | "type">>
  ) => void;

  setZoom: (zoom: number) => void;

  setPan: (x: number, y: number) => void;

  setActivePanel: (panel: EditorPanel) => void;

  markDirty: () => void;

  markClean: () => void;

  setLoading: (loading: boolean) => void;

  setSaving: (saving: boolean) => void;

  setError: (error: string | null) => void;

  setSubmitStatus: (
    status: "idle" | "saving" | "success" | "error",
    message?: string | null
  ) => void;

  resetEditor: () => void;

  addVariable: (variable: TextVariable | QRVariable) => void;

  deleteBox: (boxId: string) => void;

  undo: () => void;

  redo: () => void;
}