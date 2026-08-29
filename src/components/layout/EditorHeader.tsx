import type { Template } from "../../domain/template/template.types";

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
  isDark: boolean;
  tokens: DesignTokens;
  onToggleTheme: () => void;
  onSave: () => void;
}

export function EditorHeader({
  template,
  selectedBoxId,
  isDirty,
  isSaving,
  isDark,
  tokens,
  onToggleTheme,
  onSave,
}: EditorHeaderProps) {
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
        transition: "background-color 0.2s, border-color 0.2s"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Logo Icon */}
        <div
          style={{
            width: "28px",
            height: "28px",
            background: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)",
            borderRadius: "6px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: "bold",
            color: "#fff",
            fontSize: "14px"
          }}
        >
          E
        </div>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: tokens.textActive,
              letterSpacing: "-0.2px",
              textAlign: "left"
            }}
          >
            {template.name}
          </h1>
          <p
            style={{
              margin: "1px 0 0",
              color: tokens.text,
              fontSize: "11px",
              textAlign: "left"
            }}
          >
            Campaign: <span style={{ color: tokens.textActive }}>{template.campaign}</span>
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
            boxShadow: isDirty ? "0 0 8px #d97706" : "0 0 8px #10b981"
          }}
        />
        <span style={{ fontSize: "12px", fontWeight: 500, color: tokens.text }}>
          {isDirty ? "Unsaved changes" : "Saved"}
        </span>
      </div>

      {/* Action Controls */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        {/* Light/Dark Toggle Switch */}
        <button
          onClick={onToggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            padding: "6px 12px",
            backgroundColor: tokens.toolBtnBg,
            border: `1px solid ${tokens.toolBtnBorder}`,
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            color: tokens.textActive,
            transition: "all 0.2s"
          }}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDark ? "☀️ Light" : "🌙 Dark"}
        </button>

        {selectedBoxId && (
          <div
            style={{
              fontSize: "12px",
              color: tokens.text,
              background: tokens.toolBtnBg,
              padding: "4px 8px",
              borderRadius: "4px",
              border: `1px solid ${tokens.toolBtnBorder}`
            }}
          >
            Selected: <strong style={{ color: tokens.textActive }}>{selectedBoxId}</strong>
          </div>
        )}

        <button
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
            transition: "all 0.2s"
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
                  animation: "spin 0.8s linear infinite"
                }}
              />
              Saving
            </>
          ) : (
            "Save Template"
          )}
        </button>
      </div>
    </header>
  );
}
