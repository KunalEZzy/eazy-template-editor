import { getDefaultSubmitBoundary } from "./masterSubmit";
import { uploadImageThroughMaster } from "./masterImageUpload";

const API_BASE = import.meta.env.VITE_EDITOR_API_BASE ?? "";

export const UPLOAD_IMAGE_ENDPOINT = "/marketing/template/upload-image";

export interface TemplateImageUploadResult {
  path: string;
  fileName: string;
}

export interface TemplateImageUploadError {
  message: string;
  status?: number;
}

function buildError(error: TemplateImageUploadError): Error {
  return Object.assign(new Error(error.message), {
    status: error.status,
  });
}

export async function uploadTemplateImage(
  file: File
): Promise<TemplateImageUploadResult> {
  // Master/embedded editor uploads through the authenticated parent (the admin
  // session and CSRF token live there, not in the CloudFront iframe). Standalone
  // and restaurant/token runs keep the existing direct fetch path unchanged.
  if (getDefaultSubmitBoundary().isEmbedded) {
    const result = await uploadImageThroughMaster(file);
    return { path: result.path, fileName: result.fileName };
  }

  const formData = new FormData();
  formData.append("image", file);

  let response: Response;

  try {
    response = await fetch(`${API_BASE}${UPLOAD_IMAGE_ENDPOINT}`, {
      method: "POST",
      body: formData,
    });
  } catch {
    throw buildError({ message: "Could not reach the server. Check your connection and try again." });
  }

  if (!response.ok) {
    throw buildError({
      message: "Image upload failed. Please try again.",
      status: response.status,
    });
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw buildError({ message: "Image upload returned an invalid response." });
  }

  const payload = data as { path?: unknown; fileName?: unknown };
  if (
    typeof payload.path !== "string" ||
    typeof payload.fileName !== "string"
  ) {
    throw buildError({ message: "Image upload returned an invalid response." });
  }

  return { path: payload.path, fileName: payload.fileName };
}