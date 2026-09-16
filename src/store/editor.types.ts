import type { Template } from "../domain/template/template.types";
import type {PreviewData} from "../domain/variables/preview.types";

export type EditorPanel =
  | "layers"
  | "properties"
  | "assets"
  | null;

export interface EditorState {
  template: Template | null;

  // Editor-only representation of the template creator. Not part of the
  // persisted Template model until a Laravel-compatible field is defined.
  creator: string;

  // True once initialization has completed (e.g. an EDITOR_INIT handshake or
  // a local/standalone bootstrap finished). Used to distinguish "still
  // loading" from an explicitly initialized-empty Master CREATE state where
  // `template` is intentionally still null.
  isInitialized: boolean;

  // Changes only when a template is loaded/replaced.
  // It does NOT change for normal box movement/resizing.
  templateLoadVersion: number;

  previewData: PreviewData | null ;

  temporaryBackgroundImageUrl: string | null;

  selectedBoxId: string | null;

  zoom: number;

  panX: number;

  panY: number;

  activePanel: EditorPanel;

  isDirty: boolean;

  isLoading: boolean;

  isSaving: boolean;

  error: string | null;

  // Previous template states.
  past: Template[];

  // Template states available for redo.
  future: Template[];
}