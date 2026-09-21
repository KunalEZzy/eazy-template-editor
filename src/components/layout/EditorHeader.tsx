import type { Template } from "../../domain/template/template.types";
import { validateTemplateMetadata } from "../../domain/template/templateMetadata.validation";

export interface DesignTokens {
  bg: string;
  panelBg: string;
  border: string;
  text: string;
  textActive: string;
  gridDot: string;
  accent: string;
  accentHover: string;
  accentLight: string;
  accentText: string;
  cardBg: string;
  toolBtnBg: string;
  toolBtnBorder: string;
  shadow: string;
}

interface EditorHeaderProps {
  template: Template;
  selectedBoxId: string | null;
  isDirty: boolean;
  isSaving: boolean;
  submitStatus: "idle" | "saving" | "success" | "error";
  submitMessage: string | null;
  tokens: DesignTokens;
  onSave: () => void;
  onSubmit: () => void;
}

export function EditorHeader({
  template,
  selectedBoxId,
  isDirty,
  isSaving,
  submitStatus,
  submitMessage,
  tokens,
  onSave,
  onSubmit,
}: EditorHeaderProps) {
  const handleDownload = () => {
    window.dispatchEvent(new CustomEvent("eazy:export-canvas", { detail: { format: "png" } }));
  };

  const handleDownloadPdf = () => {
    window.dispatchEvent(new CustomEvent("eazy:export-canvas", { detail: { format: "pdf" } }));
  };

  const submissionValidation = validateTemplateMetadata({
    name: template.name,
    campaign: template.campaign,
  });

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 20px",
        borderBottom: `1px solid ${tokens.border}`,
        background: tokens.panelBg,
        height: "60px",
        boxSizing: "border-box",
        zIndex: 10,
        transition: "background-color 0.2s, border-color 0.2s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: tokens.textActive,
              letterSpacing: "-0.2px",
              textAlign: "left",
            }}
          >
            {template.name}
          </h1>
          <p
            style={{
              margin: "1px 0 0",
              color: tokens.text,
              fontSize: "11px",
              textAlign: "left",
            }}
          >
            Campaign: <span style={{ color: tokens.textActive }}>{template.campaign}</span>{" "}
            ({template.settings.canvasWidth} × {template.settings.canvasHeight}px)
          </p>
        </div>
      </div>

      {/* Center Live Badge */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: isDirty ? "#d97706" : "#10b981",
            boxShadow: isDirty ? "0 0 8px #d97706" : "0 0 8px #10b981",
          }}
        />
        <span style={{ fontSize: "12px", fontWeight: 500, color: tokens.text }}>
          {isDirty ? "Unsaved changes" : "Saved"}
        </span>
      </div>

      {/* Action Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {selectedBoxId && (
          <div
            style={{
              fontSize: "12px",
              color: tokens.text,
              background: tokens.toolBtnBg,
              padding: "4px 8px",
              borderRadius: "4px",
              border: `1px solid ${tokens.toolBtnBorder}`,
            }}
          >
            Selected: <strong style={{ color: tokens.textActive }}>{selectedBoxId}</strong>
          </div>
        )}

        {/* Export / Download PNG Button */}
        <button
          type="button"
          onClick={handleDownload}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            backgroundColor: tokens.toolBtnBg,
            border: `1px solid ${tokens.toolBtnBorder}`,
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "13px",
            color: tokens.textActive,
            transition: "all 0.2s",
          }}
          title="Download high-resolution image"
        >
          ⬇️ Download PNG
        </button>

        {/* Export / Download PDF Button */}
       <button
          type="button"
          onClick={handleDownloadPdf}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 14px",
            backgroundColor: tokens.toolBtnBg,
            border: `1px solid ${tokens.toolBtnBorder}`,
            borderRadius: "4px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "13px",
            color: tokens.textActive,
            transition: "all 0.2s",
         }}
          title="Download as PDF"
        >
          ⬇️ Download PDF
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 16px",
            background: isDirty
              ? "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)"
              : tokens.toolBtnBg,
            color: isDirty ? "#fff" : tokens.text,
            border: isDirty ? "none" : `1px solid ${tokens.toolBtnBorder}`,
            borderRadius: "4px",
            cursor: isDirty ? "pointer" : "not-allowed",
            fontWeight: 600,
            fontSize: "13px",
            boxShadow: isDirty ? "0 2px 4px rgba(124, 58, 237, 0.3)" : "none",
            transition: "all 0.2s",
          }}
        >
          {isSaving ? (
            <>
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  border: `2px solid ${isDirty ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)"}`,
                  borderTopColor: isDirty ? "#fff" : tokens.textActive,
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                }}
              />
              Saving
            </>
          ) : (
            "Save Template"
          )}
        </button>

        {/* Submit Template Button — enabled only when required metadata is valid
            and no submission is in flight. Sends the canonical template to the
            trusted parent via an integration boundary, never directly to Laravel. */}
        {submitStatus === "success" ? (
          <button
            type="button"
            onClick={onSubmit}
            title={submitMessage ?? "Template submitted successfully."}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 16px",
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "13px",
              boxShadow: "0 2px 4px rgba(5, 150, 105, 0.3)",
              transition: "all 0.2s",
            }}
          >
            Submitted ✓
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!submissionValidation.valid || submitStatus === "saving"}
            title={
              submissionValidation.valid
                ? "Submit this template to the admin portal."
                : "Complete the required template metadata (name, campaign) to submit."
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 16px",
              background: submissionValidation.valid
                ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
                : tokens.toolBtnBg,
              color: submissionValidation.valid ? "#fff" : tokens.text,
              border: submissionValidation.valid
                ? "none"
                : `1px solid ${tokens.toolBtnBorder}`,
              borderRadius: "4px",
              cursor: submissionValidation.valid ? "pointer" : "not-allowed",
              fontWeight: 600,
              fontSize: "13px",
              boxShadow: submissionValidation.valid
                ? "0 2px 4px rgba(5, 150, 105, 0.3)"
                : "none",
              transition: "all 0.2s",
            }}
          >
            {submitStatus === "saving" ? (
              <>
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    border: `2px solid ${submissionValidation.valid ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.1)"}`,
                    borderTopColor: submissionValidation.valid ? "#fff" : tokens.textActive,
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
                Submitting…
              </>
            ) : (
              "Submit Template"
            )}
          </button>
        )}
      </div>
    </header>
  );
}
