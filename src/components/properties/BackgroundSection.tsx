import {
  useRef,
  useState,
  type ChangeEvent,
} from "react";

import { useEditorStore } from "../../store/editorStore";
import { uploadTemplateImage } from "../../integration/templateImageUpload";

interface UploadStatus {
  uploading: boolean;
  error: string | null;
}

export function BackgroundSection() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    uploading: false,
    error: null,
  });

  const template = useEditorStore((state) => state.template);
  const temporaryBackgroundImageUrl = useEditorStore(
    (state) => state.temporaryBackgroundImageUrl
  );
  const setTemporaryBackgroundImage = useEditorStore(
    (state) => state.setTemporaryBackgroundImage
  );

  if (!template) {
    return null;
  }

  const savedBackgroundUrl = template.background.imageUrl;

  /*
   * Temporary background takes priority over the currently saved background.
   */
  const currentBackgroundUrl =
    temporaryBackgroundImageUrl ?? savedBackgroundUrl;

  const hasBackground = Boolean(currentBackgroundUrl);
  const isTemporary = Boolean(temporaryBackgroundImageUrl);

  const handleUploadClick = () => {
    if (uploadStatus.uploading) {
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setUploadStatus({ uploading: false, error: "Please choose an image file." });
      event.target.value = "";
      return;
    }

    setUploadStatus({ uploading: true, error: null });

    try {
      const result = await uploadTemplateImage(file);

      /*
       * IMPORTANT: No dimensions are passed here. The canonical template
       * dimensions (1200 x 1600) must remain unchanged by the upload.
       */
      setTemporaryBackgroundImage(result.path);
    } catch (error) {
      setUploadStatus({
        uploading: false,
        error:
          error instanceof Error
            ? error.message
            : "Image upload failed. Please try again.",
      });
    } finally {
      /*
       * Allows the user to select the same file again.
       */
      event.target.value = "";
      setUploadStatus((previous) => ({ ...previous, uploading: false }));
    }
  };

  const handleRemove = () => {
    setTemporaryBackgroundImage(null);
  };

  return (
    <div>
      <h3
        style={{
          fontSize: "11px",
          fontWeight: 700,
          margin: "0 0 8px",
          color: "var(--text-h)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Background
      </h3>

      {hasBackground && currentBackgroundUrl ? (
        <div style={{ marginBottom: "10px" }}>
          <img
            src={currentBackgroundUrl}
            alt="Template background"
            style={{
              display: "block",
              width: "100%",
              maxHeight: "160px",
              objectFit: "cover",
              borderRadius: "6px",
              border: "1px solid var(--border)",
            }}
          />

          {isTemporary && (
            <div
              style={{
                marginTop: "6px",
                fontSize: "10px",
                color: "var(--text)",
              }}
            >
              Unsaved background ({template.settings.canvasWidth} × {template.settings.canvasHeight})
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: "16px 8px",
            marginBottom: "10px",
            textAlign: "center",
            border: "1px dashed var(--border)",
            borderRadius: "6px",
            fontSize: "11px",
            color: "var(--text)",
          }}
        >
          No background image
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{
          display: "none",
        }}
      />

      {uploadStatus.error && (
        <div
          role="alert"
          style={{
            marginBottom: "6px",
            padding: "6px 8px",
            borderRadius: "5px",
            background: "rgba(220, 38, 38, 0.1)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            color: "#b91c1c",
            fontSize: "10px",
            lineHeight: 1.4,
          }}
        >
          {uploadStatus.error}
        </div>
      )}

      <div style={{ display: "flex", gap: "6px" }}>
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={uploadStatus.uploading}
          style={{
            flex: 1,
            padding: "7px 8px",
            borderRadius: "5px",
            border: "1px solid var(--border)",
            background: "var(--tool-btn-bg)",
            color: "var(--text)",
            cursor: uploadStatus.uploading ? "not-allowed" : "pointer",
            fontSize: "11px",
            fontWeight: 600,
            opacity: uploadStatus.uploading ? 0.6 : 1,
          }}
        >
          {uploadStatus.uploading
            ? "Uploading..."
            : hasBackground
              ? "Change Image"
              : "Upload Image"}
        </button>

        {hasBackground && (
          <button
            type="button"
            onClick={handleRemove}
            disabled={uploadStatus.uploading}
            style={{
              padding: "7px 10px",
              borderRadius: "5px",
              border: "1px solid var(--border)",
              background: "var(--tool-btn-bg)",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: "11px",
              fontWeight: 600,
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}