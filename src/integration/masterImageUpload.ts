import {
  isImageUploadErrorMessage,
  isImageUploadSuccessMessage,
  type EditorImageUploadRequestMessage,
} from "./editorProtocol";

const PARENT_ORIGIN = import.meta.env.VITE_EDITOR_PARENT_ORIGIN;

/**
 * The only external system the Master editor is allowed to know about: the
 * trusted parent window that owns the authenticated admin session and relays
 * background image uploads to DynamicPosterController::uploadImage(). The
 * editor never talks to Laravel directly for uploads in Master mode (Step 9A)
 * — it posts IMAGE_UPLOAD_REQUEST here and waits for the relayed outcome.
 */
export interface MasterImageUploadBoundary {
  parentOrigin: string;
  parentWindow: unknown;
  isEmbedded: boolean;
  postMessage: (message: unknown, targetOrigin: string) => void;
}

export function getDefaultMasterImageUploadBoundary(): MasterImageUploadBoundary {
  const embedded = window.parent !== window;
  return {
    parentOrigin: PARENT_ORIGIN,
    parentWindow: window.parent,
    isEmbedded: embedded,
    postMessage: (message, targetOrigin) =>
      window.parent.postMessage(message, targetOrigin),
  };
}

export function buildImageUploadRequestMessage(
  file: File
): EditorImageUploadRequestMessage {
  return {
    type: "IMAGE_UPLOAD_REQUEST",
    version: 1,
    payload: {
      file,
    },
  };
}

export interface MasterImageUploadResult {
  path: string;
  fileName: string;
}

export const IMAGE_UPLOAD_TIMEOUT_MS = 60_000;

/**
 * Upload a background image through the trusted parent. Sends the raw File
 * (done via postMessage structured clone, never JSON or base64) and resolves
 * with the Laravel `{ path, fileName }` response relayed, or rejects with the
 * parent's error message on IMAGE_UPLOAD_ERROR. The message listener and the
 * timeout timer are always cleaned up once the promise settles.
 */
export function uploadImageThroughMaster(
  file: File,
  boundary: MasterImageUploadBoundary = getDefaultMasterImageUploadBoundary()
): Promise<MasterImageUploadResult> {
  return new Promise((resolve, reject) => {
    if (!boundary.isEmbedded) {
      reject(new Error("Image upload is only available inside the admin portal."));
      return;
    }

    let settled = false;
    let timeoutId = 0;

    const finish = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("message", handleMessage);
      window.clearTimeout(timeoutId);
      handler();
    };

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== boundary.parentOrigin) {
        return;
      }

      if (event.source !== boundary.parentWindow) {
        return;
      }

      if (isImageUploadSuccessMessage(event.data)) {
        finish(() =>
          resolve({
            path: event.data.payload.path,
            fileName: event.data.payload.fileName,
          })
        );
        return;
      }

      if (isImageUploadErrorMessage(event.data)) {
        finish(() => reject(new Error(event.data.payload.message)));
      }
    };

    timeoutId = window.setTimeout(() => {
      finish(() =>
        reject(new Error("The image upload timed out. Please try again."))
      );
    }, IMAGE_UPLOAD_TIMEOUT_MS);

    window.addEventListener("message", handleMessage);

    boundary.postMessage(
      buildImageUploadRequestMessage(file),
      boundary.parentOrigin
    );
  });
}