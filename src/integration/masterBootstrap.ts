import { useEffect } from "react";
import { useEditorStore } from "../store/editorStore";
import { createEmptyTemplate } from "../domain/template/template.empty";
import {
  isEditorInitMessage,
  isSetBackgroundImageMessage,
  EDITOR_PROTOCOL_VERSION,
  type EditorInitMessage,
  type EditorSetBackgroundImageMessage,
  type EditorRequestBackgroundUploadMessage,
} from "./editorProtocol";
import {
  clearMasterCreateDraft,
  loadMasterCreateDraft,
  saveMasterCreateDraft,
} from "./masterCreateDraft";
import { readStoredTemplate } from "../repository/LocalTemplateRepository";
import type { Template } from "../domain/template/template.types";

const PARENT_ORIGIN = import.meta.env.VITE_EDITOR_PARENT_ORIGIN;

/**
 * Return this browser's own saved copy of an existing template when it is newer
 * than the database row, otherwise null.
 *
 * "Save Template" writes to localStorage, but Master EDIT otherwise re-hydrates
 * from Laravel on every load, so without this the local save would be
 * invisible: the work would silently disappear on the next reload. The
 * comparison is against the row's real `updated_at` (forwarded by
 * LegacyTemplateAdapter), so a database edit made anywhere else still wins.
 */
export function pickNewerLocalTemplate(
  persistedTemplate: Template
): Template | null {
  const stored = readStoredTemplate(persistedTemplate.id);

  if (!stored) {
    return null;
  }

  const storedAt = Date.parse(stored.updatedAt);
  const persistedAt = Date.parse(persistedTemplate.updatedAt);

  // An unusable timestamp on either side means "cannot prove it is newer", so
  // the database row stays authoritative.
  if (Number.isNaN(storedAt) || Number.isNaN(persistedAt)) {
    return null;
  }

  return storedAt > persistedAt ? stored : null;
}

/**
 * Apply a validated EDITOR_INIT message to the store.
 * Exported separately so it can be unit-tested without simulating window.postMessage.
 */
export function applyEditorInitMessage(message: EditorInitMessage): void {
  const {
    setError,
    setInitialized,
    setTemplate,
    setPreviewData,
    setCreator,
    setEditorMode,
    setRestoredLocalCopy,
    markDirty,
  } = useEditorStore.getState();

  setError(null);
  setInitialized(true);

  // Master CREATE: the parent explicitly reported no persisted template.
  // Materialize a blank working document so the editor UI (layers, variable
  // picker, properties panel, canvas) works exactly as in Edit — but with no
  // mock background, boxes or preview data.
  //
  // If this browser holds a draft from a previous unsaved CREATE session, resume
  // it instead. Otherwise a refresh between "upload background" and "submit"
  // silently discards the editor's work while leaving the uploaded S3 object
  // orphaned, because nothing is persisted until Submit.
  if (message.payload.template === null) {
    setTemplate(loadMasterCreateDraft() ?? createEmptyTemplate());
    setEditorMode("master-create");
    setRestoredLocalCopy(false);
    return;
  }

  // A persisted template means the user is editing a real row, so any leftover
  // draft belongs to a different (already submitted) session.
  clearMasterCreateDraft();

  const localCopy = pickNewerLocalTemplate(message.payload.template);

  setTemplate(localCopy ?? message.payload.template);
  setEditorMode("master-edit");

  // A restored browser copy is not in the database, so it stays dirty and the
  // banner must say so until the user submits it.
  setRestoredLocalCopy(localCopy !== null);

  if (localCopy) {
    markDirty();
  }

  // setTemplate clears creator; restore the original creator for the loaded
  // template so the info box keeps showing who created it.
  setCreator(message.payload.createdBy ?? "");

  if (message.payload.previewData) {
    setPreviewData(message.payload.previewData);
  }
}

// ---------------------------------------------------------------------------
// Parent-driven background image handling
// ---------------------------------------------------------------------------
//
// The Laravel parent owns authentication, CSRF and the upload itself. After it
// has stored the image it posts the returned CDN URL back as
// SET_BACKGROUND_IMAGE, and this handler applies it to the store so the Fabric
// canvas redraws the master background. The editor never uploads to Laravel and
// never invents a URL of its own.

export interface MasterBackgroundImageBoundary {
  parentOrigin: string;
  parentWindow: unknown;
  postMessage: (message: unknown, targetOrigin: string) => void;
}

export function getDefaultBackgroundImageBoundary(): MasterBackgroundImageBoundary {
  return {
    parentOrigin: PARENT_ORIGIN,
    parentWindow: window.parent,
    postMessage: (message, targetOrigin) =>
      window.parent.postMessage(message, targetOrigin),
  };
}

export type BackgroundImageOutcome = "ignored" | "applied" | "error";

export type BackgroundUploadRequestOutcome = "sent" | "not-embedded";

/**
 * Ask the parent to open the file input it owns. Returns "not-embedded" when the
 * editor is running standalone, where the direct upload path is used instead and
 * there is no parent to talk to.
 */
export function requestBackgroundUpload(
  boundary: MasterBackgroundImageBoundary = getDefaultBackgroundImageBoundary()
): BackgroundUploadRequestOutcome {
  if (typeof window === "undefined" || window.parent === window) {
    return "not-embedded";
  }

  const message: EditorRequestBackgroundUploadMessage = {
    type: "REQUEST_BACKGROUND_UPLOAD",
    version: EDITOR_PROTOCOL_VERSION,
  };

  boundary.postMessage(message, boundary.parentOrigin);

  return "sent";
}

/**
 * Apply a validated SET_BACKGROUND_IMAGE payload to the store.
 * Exported separately so it can be unit-tested without simulating postMessage.
 * Throws when the current mode must refuse the change.
 */
export function applySetBackgroundImageMessage(
  message: EditorSetBackgroundImageMessage
): void {
  const { editorMode, setTemporaryBackgroundImage } = useEditorStore.getState();

  // Master Edit locks the master background, and setTemporaryBackgroundImage
  // silently returns the identical state in that mode. Refuse explicitly here
  // instead: acknowledging a successful apply the store never performed would
  // tell the parent the background changed when nothing happened.
  if (editorMode === "master-edit") {
    throw new Error(
      "The background of an existing template cannot be replaced here."
    );
  }

  setTemporaryBackgroundImage(message.payload.imageUrl);

  // The upload already succeeded in S3, but in master-create nothing is
  // persisted until Submit. Checkpoint the draft now so a refresh cannot orphan
  // the object we just paid to store.
  const { template } = useEditorStore.getState();

  if (editorMode === "master-create" && template) {
    saveMasterCreateDraft(template);
  }
}

/**
 * Validate, apply and acknowledge a SET_BACKGROUND_IMAGE event.
 * Returns "ignored" for anything that is not a well-formed message from the
 * trusted parent, so the caller can fall through to the other handlers.
 */
export function applySetBackgroundImageEvent(
  event: { origin: string; source: unknown; data: unknown },
  boundary: MasterBackgroundImageBoundary = getDefaultBackgroundImageBoundary()
): BackgroundImageOutcome {
  if (event.origin !== boundary.parentOrigin) {
    return "ignored";
  }

  if (event.source !== boundary.parentWindow) {
    return "ignored";
  }

  if (!isSetBackgroundImageMessage(event.data)) {
    return "ignored";
  }

  const message = event.data as EditorSetBackgroundImageMessage;

  try {
    applySetBackgroundImageMessage(message);
  } catch (error) {
    boundary.postMessage(
      {
        type: "BACKGROUND_IMAGE_APPLY_ERROR",
        version: EDITOR_PROTOCOL_VERSION,
        payload: {
          message:
            error instanceof Error
              ? error.message
              : "The background image could not be applied.",
        },
      },
      boundary.parentOrigin
    );
    return "error";
  }

  boundary.postMessage(
    { type: "BACKGROUND_IMAGE_APPLIED", version: EDITOR_PROTOCOL_VERSION },
    boundary.parentOrigin
  );
  return "applied";
}

export function useMasterBootstrap() {
  const setError = useEditorStore((state) => state.setError);

  useEffect(() => {
    const isEmbedded = window.parent !== window;
    console.log("[Editor] Master bootstrap", {
      isEmbedded,
      parentOrigin: PARENT_ORIGIN,
      currentOrigin: window.location.origin,
    });
    if (isEmbedded) {
      console.log("[Editor] Sending EDITOR_READY", {
        targetOrigin: PARENT_ORIGIN,
      });
      window.parent.postMessage(
        {
          type: "EDITOR_READY",
          version: 1,
        },
        PARENT_ORIGIN
      );
    }

    function handleMessage(event: MessageEvent) {

      console.log("[Editor] Received message", {
        origin: event.origin,
        sourceMatches: event.source === window.parent,
        data: event.data,
      });

      if (event.origin !== PARENT_ORIGIN) {
        return;
      }

      if (event.source !== window.parent) {
        return;
      }

      // SET_BACKGROUND_IMAGE is routed separately from EDITOR_INIT: it is a
      // standalone, repeatable update to the background and must never
      // re-initialize the editor or reset the working template.
      if (applySetBackgroundImageEvent(event) !== "ignored") {
        return;
      }

      if (!isEditorInitMessage(event.data)) {
        return;
      }

      const message = event.data as EditorInitMessage;

      try {
        applyEditorInitMessage(message);
      } catch (error) {
        console.error("Could not initialize the template editor:", error);
        setError(
          "We couldn't start the editor. Please refresh the page and try again."
        );
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [setError]);
}
