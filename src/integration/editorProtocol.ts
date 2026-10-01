import type { Template } from "../domain/template/template.types";
import { isTemplate } from "../domain/template/template.validation";
import type { PreviewData } from "../domain/variables/preview.types";

export const EDITOR_PROTOCOL_VERSION = 1 as const;

export type EditorMode = "master";

export interface EditorCapabilities {
  canSave: boolean;
}

export interface EditorInitPayload {
  mode: EditorMode;
  // `null` is the legitimate Master CREATE state: the parent explicitly
  // reports that no persisted template exists yet. A real template is only
  // carried for Master EDIT.
  template: Template | null;
  previewData?: PreviewData | null;
  // The name of the person who created the template, provided by the parent
  // for Master EDIT so the info box can show it. Optional and never validated
  // as part of isEditorInitMessage.
  createdBy?: string | null;
  capabilities: EditorCapabilities;
}

export interface EditorInitMessage {
  type: "EDITOR_INIT";
  version: typeof EDITOR_PROTOCOL_VERSION;
  payload: EditorInitPayload;
}

export interface EditorReadyMessage {
  type: "EDITOR_READY";
  version: typeof EDITOR_PROTOCOL_VERSION;
}

export function isEditorInitMessage(
  value: unknown
): value is EditorInitMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;

  if (
    message.type !== "EDITOR_INIT" ||
    message.version !== EDITOR_PROTOCOL_VERSION
  ) {
    return false;
  }

  if (!message.payload || typeof message.payload !== "object") {
    return false;
  }

  const payload = message.payload as Record<string, unknown>;

  if (payload.mode !== "master") {
    return false;
  }

  // Master CREATE is legal with `template: null`.
  if (payload.template !== null) {
    // A provided template must still be a valid canonical template.
    if (!isTemplate(payload.template)) {
      return false;
    }
  }

  if (!payload.capabilities || typeof payload.capabilities !== "object") {
    return false;
  }

  const capabilities = payload.capabilities as Record<string, unknown>;

  return typeof capabilities.canSave === "boolean";
}

// ---------------------------------------------------------------------------
// Master Template Submit protocol
// ---------------------------------------------------------------------------
//
// The React editor never calls the Laravel persistence endpoint directly. It
// posts a SAVE_REQUEST to the trusted parent window, and the parent (the Blade
// page that owns the authenticated admin session) is the only party that can
// POST to Laravel. The parent must relay the outcome back with SAVE_SUCCESS or
// SAVE_ERROR so the editor can hydrate the persisted row / surface failures.

export interface EditorSaveRequestMessage {
  type: "SAVE_REQUEST";
  version: typeof EDITOR_PROTOCOL_VERSION;
  payload: {
    template: Template;
  };
}

export interface EditorSaveSuccessMessage {
  type: "SAVE_SUCCESS";
  version: typeof EDITOR_PROTOCOL_VERSION;
  payload: {
    // The persisted React template exactly as Laravel returned it (for CREATE
    // this carries the freshly-persisted id so the editor can bind to it).
    template: Template;
    // The persisted poster_template row id.
    id: string;
  };
}

export interface EditorSaveErrorMessage {
  type: "SAVE_ERROR";
  version: typeof EDITOR_PROTOCOL_VERSION;
  payload: {
    message: string;
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isSaveRequestMessage(
  value: unknown
): value is EditorSaveRequestMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;

  if (
    message.type !== "SAVE_REQUEST" ||
    message.version !== EDITOR_PROTOCOL_VERSION
  ) {
    return false;
  }

  if (!message.payload || typeof message.payload !== "object") {
    return false;
  }

  const payload = message.payload as Record<string, unknown>;

  return isTemplate(payload.template);
}

export function isSaveSuccessMessage(
  value: unknown
): value is EditorSaveSuccessMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;

  if (
    message.type !== "SAVE_SUCCESS" ||
    message.version !== EDITOR_PROTOCOL_VERSION
  ) {
    return false;
  }

  if (!message.payload || typeof message.payload !== "object") {
    return false;
  }

  const payload = message.payload as Record<string, unknown>;

  return isTemplate(payload.template) && isNonEmptyString(payload.id);
}

export function isSaveErrorMessage(
  value: unknown
): value is EditorSaveErrorMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;

  if (
    message.type !== "SAVE_ERROR" ||
    message.version !== EDITOR_PROTOCOL_VERSION
  ) {
    return false;
  }

  if (!message.payload || typeof message.payload !== "object") {
    return false;
  }

  const payload = message.payload as Record<string, unknown>;

  return isNonEmptyString(payload.message);
}

// ---------------------------------------------------------------------------
// Master Background Image protocol
// ---------------------------------------------------------------------------
//
// The editor iframe runs on the editor's own origin and holds no admin session
// and no CSRF token, so it never uploads a background image itself. The
// authenticated parent page owns the file input, posts the file to
// DynamicPosterController::uploadImage(), and pushes the resulting CDN URL into
// the iframe as SET_BACKGROUND_IMAGE. Only the URL crosses the boundary - never
// the file bytes and never base64.

export interface EditorSetBackgroundImageMessage {
  type: "SET_BACKGROUND_IMAGE";
  version: typeof EDITOR_PROTOCOL_VERSION;
  payload: {
    imageUrl: string;
    // Echoes of the S3 key and object name the parent already knows. The editor
    // does not need them today, so they stay optional and are not validated:
    // tolerating their absence keeps an older parent working against a newer
    // editor.
    path?: string;
    fileName?: string;
  };
}

export function isSetBackgroundImageMessage(
  value: unknown
): value is EditorSetBackgroundImageMessage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const message = value as Record<string, unknown>;

  if (
    message.type !== "SET_BACKGROUND_IMAGE" ||
    message.version !== EDITOR_PROTOCOL_VERSION
  ) {
    return false;
  }

  if (!message.payload || typeof message.payload !== "object") {
    return false;
  }

  const payload = message.payload as Record<string, unknown>;

  return isNonEmptyString(payload.imageUrl);
}

// Editor -> parent: open the parent's own file input. The parent holds the admin
// session and CSRF token, so it is the only side that can upload. The parent
// treats this as a convenience; its visible upload button remains the
// authoritative control because a programmatic input.click() can be rejected by
// the browser when it is no longer inside a user-activation task.
export interface EditorRequestBackgroundUploadMessage {
  type: "REQUEST_BACKGROUND_UPLOAD";
  version: typeof EDITOR_PROTOCOL_VERSION;
}
