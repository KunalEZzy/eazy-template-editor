import type { Template } from "../domain/template/template.types";
import type {PreviewData} from "../domain/variables/preview.types";

export type EditorPanel =
  | "layers"
  | "properties"
  | "assets"
  | null;

// Runtime UI mode, determined once at bootstrap. Deliberately separate from the
// wire-level `EditorMode` in editorProtocol.ts (which only ever carries
// "master") so the React runtime can distinguish Master Create, Master Edit and
// the restaurant editor without extending the postMessage contract.
//
// `null` is the "not yet determined" state and is the permanent value for the
// standalone demo bootstrap, which is neither a master session nor a restaurant
// session.
export type EditorRuntimeMode =
  | "master-create"
  | "master-edit"
  | "restaurant";

export interface EditorState {
  template: Template | null;

  // Editor-only representation of the template creator. Not part of the
  // persisted Template model until a Laravel-compatible field is defined.
  creator: string;

  // Runtime UI mode. Set by masterBootstrap (master-create / master-edit) or
  // useEditorToken (restaurant). Null for the standalone demo bootstrap.
  editorMode: EditorRuntimeMode | null;

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

  // Master template submit lifecycle. Used by the Submit Template flow that
  // posts SAVE_REQUEST to the trusted parent and waits for SAVE_SUCCESS /
  // SAVE_ERROR. Distinct from `isSaving` which remains the local Save
  // Template (export) flow.
  submitStatus: "idle" | "saving" | "success" | "error";

  submitMessage: string | null;

  // True when Master Edit hydrated the template from this browser's own copy
  // ("Save Template") instead of the database row, because the local copy is
  // newer. That work is still not in the database and needs a Submit, so it
  // survives further local saves and is cleared only once the bootstrap or a
  // successful Submit replaces the working document with a persisted one.
  restoredLocalCopy: boolean;

  // Previous template states.
  past: Template[];

  // Template states available for redo.
  future: Template[];
}