import {
  useEffect,
  useRef,
  type ChangeEvent,
} from "react";

import { useEditorStore } from "../../store/editorStore";

export function BackgroundSection() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const template = useEditorStore(
    (state) => state.template
  );

  const temporaryBackgroundImageUrl =
    useEditorStore(
      (state) => state.temporaryBackgroundImageUrl
    );

  const setTemporaryBackgroundImage =
    useEditorStore(
      (state) => state.setTemporaryBackgroundImage
    );

  /*
   * Release the previous object URL when the
   * temporary background changes or the component
   * unmounts.
   */
  useEffect(() => {
    return () => {
      if (temporaryBackgroundImageUrl) {
        URL.revokeObjectURL(
          temporaryBackgroundImageUrl
        );
      }
    };
  }, [temporaryBackgroundImageUrl]);

  if (!template) {
    return null;
  }

  const savedBackgroundUrl =
    template.background.imageUrl;

  /*
   * Temporary background takes priority over the
   * currently saved background.
   */
  const currentBackgroundUrl =
    temporaryBackgroundImageUrl ??
    savedBackgroundUrl;

  const hasBackground =
    Boolean(currentBackgroundUrl);

  const isTemporary =
    Boolean(temporaryBackgroundImageUrl);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      event.target.value = "";
      return;
    }

    const objectUrl =
      URL.createObjectURL(file);

    setTemporaryBackgroundImage(objectUrl);

    /*
     * Allows the user to select the same file again.
     */
    event.target.value = "";
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
        <div
          style={{
            marginBottom: "10px",
          }}
        >
          <img
            src={currentBackgroundUrl}
            alt="Template background"
            style={{
              display: "block",
              width: "100%",
              maxHeight: "160px",
              objectFit: "cover",
              borderRadius: "6px",
              border:
                "1px solid var(--border)",
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
              Unsaved background
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: "16px 8px",
            marginBottom: "10px",
            textAlign: "center",
            border:
              "1px dashed var(--border)",
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

      <div
        style={{
          display: "flex",
          gap: "6px",
        }}
      >
        <button
          type="button"
          onClick={handleUploadClick}
          style={{
            flex: 1,
            padding: "7px 8px",
            borderRadius: "5px",
            border:
              "1px solid var(--border)",
            background:
              "var(--tool-btn-bg)",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          {hasBackground
            ? "Change Image"
            : "Upload Image"}
        </button>

        {hasBackground && (
          <button
            type="button"
            onClick={handleRemove}
            style={{
              padding: "7px 10px",
              borderRadius: "5px",
              border:
                "1px solid var(--border)",
              background:
                "var(--tool-btn-bg)",
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