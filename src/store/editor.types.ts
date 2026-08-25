import type { Template } from "../domain/template/template.types";

export type EditorPanel =
  | "layers"
  | "properties"
  | "assets"
  | null;

export interface EditorState {
  template: Template | null;

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