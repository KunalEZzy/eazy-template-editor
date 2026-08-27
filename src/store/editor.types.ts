import type { Template } from "../domain/template/template.types";

export type EditorPanel =
  | "layers"
  | "properties"
  | "assets"
  | null;

export interface EditorState {
  template: Template | null;

  // Changes only when a template is loaded/replaced.
  // It does NOT change for normal box movement/resizing.
  templateLoadVersion: number;

  selectedBoxId: string | null;

  zoom: number;

  panX: number;

  panY: number;

  activePanel: EditorPanel;

  isDirty: boolean;

  isLoading: boolean;

  isSaving: boolean;

  error: string | null;
}