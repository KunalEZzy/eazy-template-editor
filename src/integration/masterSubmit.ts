import { useEffect } from "react";
import { useEditorStore } from "../store/editorStore";
import type { Template } from "../domain/template/template.types";
import { validateTemplateMetadata } from "../domain/template/templateMetadata.validation";
import {
  isSaveErrorMessage,
  isSaveSuccessMessage,
  type EditorSaveRequestMessage,
  type EditorSaveSuccessMessage,
  type EditorSaveErrorMessage,
} from "./editorProtocol";

const PARENT_ORIGIN = import.meta.env.VITE_EDITOR_PARENT_ORIGIN;

/**
 * The only external system the Master editor is allowed to know about: the
 * trusted parent window that owns the authenticated admin session and the
 * Laravel persistence endpoint. The editor never talks to Laravel directly
 * (Step 8A) — it posts SAVE_REQUEST here and waits for the relayed outcome.
 */
export interface TemplateSubmitBoundary {
  parentOrigin: string;
  parentWindow: unknown;
  isEmbedded: boolean;
  postMessage: (message: unknown, targetOrigin: string) => void;
}

export function getDefaultSubmitBoundary(): TemplateSubmitBoundary {
  const embedded = window.parent !== window;
  return {
    parentOrigin: PARENT_ORIGIN,
    parentWindow: window.parent,
    isEmbedded: embedded,
    postMessage: (message, targetOrigin) =>
      window.parent.postMessage(message, targetOrigin),
  };
}

export function buildSaveRequestMessage(
  template: Template
): EditorSaveRequestMessage {
  return {
    type: "SAVE_REQUEST",
    version: 1,
    payload: {
      template,
    },
  };
}

/**
 * Gate check before the editor is allowed to post a SAVE_REQUEST. Mirrors the
 * Step 5.6 submission validation so the UI button state and the integration
 * boundary always agree: name and campaign are required.
 */
export function canSubmitTemplate(template: Template | null): boolean {
  if (!template) {
    return false;
  }

  return validateTemplateMetadata({
    name: template.name,
    campaign: template.campaign,
  }).valid;
}

/**
 * Request the parent (which owns the Laravel session) to persist the template.
 * Returns false and surfaces the reason when the template cannot be submitted,
 * and true once a SAVE_REQUEST has been posted.
 */
export function requestTemplateSubmit(
  template: Template | null,
  boundary: TemplateSubmitBoundary = getDefaultSubmitBoundary()
): boolean {
  const store = useEditorStore.getState();

  if (template === null || !canSubmitTemplate(template)) {
    store.setSubmitStatus(
      "error",
      template === null
        ? "Nothing to submit yet."
        : "Template metadata is incomplete. Name and campaign are required."
    );
    return false;
  }

  if (!boundary.isEmbedded) {
    store.setSubmitStatus(
      "error",
      "Submit is only available inside the admin portal."
    );
    return false;
  }

  store.setSubmitStatus("saving");

  boundary.postMessage(buildSaveRequestMessage(template), boundary.parentOrigin);

  return true;
}

/**
 * Apply a validated SAVE_SUCCESS message: hydrate the persisted React template
 * (for CREATE this binds the freshly-persisted id back into the editor) and
 * clear the pending state. `setTemplate` already clears the dirty flag.
 */
export function applySaveSuccessMessage(message: EditorSaveSuccessMessage): void {
  const store = useEditorStore.getState();

  // setTemplate clears the editor-only creator; keep the existing creator
  // across a save round-trip so the info box is not blanked out.
  const creator = store.creator;

  store.setTemplate(message.payload.template);
  store.setCreator(creator);
  store.setSubmitStatus("success", "Template saved successfully.");
}

/**
 * Apply a validated SAVE_ERROR message. The working template is deliberately
 * left untouched so the user keeps every unsaved edit, and the editor returns
 * to the "saving" → "error" state so the failures are visible.
 */
export function applySaveErrorMessage(message: EditorSaveErrorMessage): void {
  const store = useEditorStore.getState();

  store.setSubmitStatus("error", message.payload.message);
}

export type SaveResponseOutcome = "saved" | "error" | "ignored";

/**
 * Pure, testable handler for incoming parent messages. Mirrors the guards of
 * the bootstrap handshake (trusted origin + trusted source + version/schema
 * validation). Anything that does not pass every guard is ignored.
 */
export function applySaveResponseEvent(
  event: { origin: string; source: unknown; data: unknown },
  boundary: TemplateSubmitBoundary = getDefaultSubmitBoundary()
): SaveResponseOutcome {
  if (event.origin !== boundary.parentOrigin) {
    return "ignored";
  }

  if (event.source !== boundary.parentWindow) {
    return "ignored";
  }

  if (isSaveErrorMessage(event.data)) {
    applySaveErrorMessage(event.data);
    return "error";
  }

  if (isSaveSuccessMessage(event.data)) {
    applySaveSuccessMessage(event.data);
    return "saved";
  }

  return "ignored";
}

export function useMasterSubmit() {
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      applySaveResponseEvent(event);
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);
}