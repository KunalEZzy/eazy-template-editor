import { useEffect } from "react";
import { useEditorStore } from "../store/editorStore";
import { createEmptyTemplate } from "../domain/template/template.empty";
import {
  isEditorInitMessage,
  type EditorInitMessage,
} from "./editorProtocol";

const PARENT_ORIGIN = import.meta.env.VITE_EDITOR_PARENT_ORIGIN;

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
  } = useEditorStore.getState();

  setError(null);
  setInitialized(true);

  // Master CREATE: the parent explicitly reported no persisted template.
  // Materialize a blank working document so the editor UI (layers, variable
  // picker, properties panel, canvas) works exactly as in Edit — but with no
  // mock background, boxes or preview data.
  if (message.payload.template === null) {
    setTemplate(createEmptyTemplate());
    return;
  }

  setTemplate(message.payload.template);

  if (message.payload.previewData) {
    setPreviewData(message.payload.previewData);
  }
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

      if (!isEditorInitMessage(event.data)) {
        return;
      }

      const message = event.data as EditorInitMessage;

      try {
        applyEditorInitMessage(message);
      } catch (error) {
        setError(
          error instanceof Error
            ? error.message
            : "Could not initialize the template editor."
        );
      }
    }

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [setError]);
}
