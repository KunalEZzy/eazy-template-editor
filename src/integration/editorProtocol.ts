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
