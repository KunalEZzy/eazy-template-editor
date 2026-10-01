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

/**
 * Direct multipart upload to Laravel. Only reachable from the standalone and
 * restaurant/token editor, which authenticate with their own editor token.
 *
 * Master mode must never call this: the editor runs in a CloudFront iframe with
 * no admin session and no CSRF token. There the parent page performs the upload
 * and pushes the resulting URL in as SET_BACKGROUND_IMAGE (see
 * integration/masterBootstrap.ts).
 */
export async function uploadTemplateImage(
  file: File
): Promise<TemplateImageUploadResult> {
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