import { useEffect, useState } from "react";

import { mockTemplate } from "./domain/template/template.mock";
import { useEditorStore } from "./store/editorStore";
import { CanvasEditor } from "./canvas/CanvasEditor";
import { mockPreviewData } from "./domain/variables/preview.mock";
import { EditorService } from "./editor/editor.service";
import { LocalTemplateRepository } from "./repository/LocalTemplateRepository";
import { PropertiesPanel } from "./editor/PropertiesPanel";

const repository = new LocalTemplateRepository();

const editorService = new EditorService(
  repository
);

const TEMPLATE_ID = mockTemplate.id;
const RESET_TEMPLATE_FOR_TEST = false;

function App() {
  const template = useEditorStore(
    (state) => state.template
  );

  const selectedBoxId = useEditorStore(
    (state) => state.selectedBoxId
  );

  const isSaving = useEditorStore(
    (state) => state.isSaving
  );

  const isDirty = useEditorStore(
    (state) => state.isDirty
  );

  const setTemplate = useEditorStore(
    (state) => state.setTemplate
  );

  const selectBox = useEditorStore(
    (state) => state.selectBox
  );

  const updateTextBox = useEditorStore(
    (state) => state.updateTextBox
  );

  const setSaving = useEditorStore(
    (state) => state.setSaving
  );

  const setError = useEditorStore(
    (state) => state.setError
  );

  // Light/Dark mode state initialized from localStorage with user system preferences fallback
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem("eazy-theme");
    if (saved) {
      return saved === "dark";
    }
    // Fallback to system preference
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return true; // default to dark
  });

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("eazy-theme", next ? "dark" : "light");
      return next;
    });
  };

  // Dynamically expand #root to full width to support a clean sidebar layout
  // and eliminate horizontal overflow issues.
  useEffect(() => {
    const root = document.getElementById("root");
    if (root) {
      root.style.width = "100%";
      root.style.maxWidth = "100%";
      root.style.borderInline = "none";
      root.style.margin = "0";
      root.style.padding = "0";
    }
  }, []);

  useEffect(() => {
    async function loadTemplate() {
      try {
        if (RESET_TEMPLATE_FOR_TEST) {
          localStorage.removeItem(
            "eazy-template-editor:templates"
          );
        }

        const template =
          await editorService.loadTemplate(
            TEMPLATE_ID
          );

        console.log(
          "LOADED TEMPLATE:",
          template
        );

        setTemplate(template);
      } catch (error) {
        console.error(
          "Failed to load template:",
          error
        );
      }
    }

    loadTemplate();
  }, [setTemplate]);

  if (!template) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily: "system-ui, sans-serif",
          color: isDark ? "#9ca3af" : "#4b5563",
          background: isDark ? "#121212" : "#f3f4f6"
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #e5e7eb",
              borderTopColor: "#7c3aed",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px"
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div>Loading template editor...</div>
        </div>
      </div>
    );
  }

  const discountBox = template.boxes.find(
    (box) => box.id === "box-discount"
  );

  const handleSave = async () => {
    if (!template || !isDirty) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      console.log("TEMPLATE BEING SAVED:", template);

      const savedTemplate =
        await editorService.saveTemplate(
          template
        );

      console.log(
        "TEMPLATE RETURNED FROM SAVE:",
        savedTemplate
      );

      setTemplate(savedTemplate);
    } catch (error) {
      console.error(
        "Failed to save template:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Failed to save template"
      );
    } finally {
      setSaving(false);
    }
  };

  // Core Design Tokens mapping dynamically based on current theme mode
  const tokens = {
    bg: isDark ? "#121212" : "#f3f4f6", // Main workbench backdrop
    panelBg: isDark ? "#181818" : "#ffffff", // Sidebar/header backgrounds
    border: isDark ? "#2d2d2d" : "#e5e7eb", // Dividers & borders
    text: isDark ? "#a0a0a0" : "#4b5563", // Secondary label/body text
    textActive: isDark ? "#ffffff" : "#111827", // Primary headings & active text
    gridDot: isDark ? "#2a2a2a" : "#d1d5db", // Canvas background grid dot color
    accent: "#7c3aed", // Theme purple accent
    accentHover: isDark ? "#9333ea" : "#6d28d9",
    accentLight: isDark ? "#2a1b4e" : "#f3e8ff", // Layer highlight background
    accentText: isDark ? "#c084fc" : "#6d28d9", // Layer highlight text
    cardBg: isDark ? "#1e1e1e" : "#ffffff", // Sidebar widgets card background
    toolBtnBg: isDark ? "#2a2a2a" : "#f3f4f6",
    toolBtnBorder: isDark ? "#3e3e3e" : "#e5e7eb",
    shadow: isDark
      ? "0 10px 25px -5px rgba(0,0,0,0.6), 0 8px 10px -6px rgba(0,0,0,0.6)"
      : "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)"
  };

  return (
    <div
      className={isDark ? "theme-dark" : "theme-light"}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100%",
        overflow: "hidden",
        boxSizing: "border-box",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
        backgroundColor: tokens.bg,
        color: tokens.text,
        transition: "background-color 0.2s, color 0.2s"
      }}
    >
      {/* Top Navigation Bar */}
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
            onClick={toggleTheme}
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
            onClick={handleSave}
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

      {/* Main Workspace Frame */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          background: tokens.bg,
          transition: "background-color 0.2s"
        }}
      >
        {/* Left Sidebar: Layers list & Action Panel */}
        <aside
          style={{
            width: "260px",
            borderRight: `1px solid ${tokens.border}`,
            background: tokens.panelBg,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            boxSizing: "border-box",
            transition: "background-color 0.2s, border-color 0.2s"
          }}
        >
          {/* Layers Section */}
          <div style={{ padding: "16px", borderBottom: `1px solid ${tokens.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: tokens.text, margin: 0, letterSpacing: "0.5px" }}>
                Layers ({template.boxes.length})
              </h2>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {template.boxes.map((box) => {
                const isSelected = selectedBoxId === box.id;
                return (
                  <button
                    key={box.id}
                    onClick={() => selectBox(box.id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      textAlign: "left",
                      background: isSelected ? tokens.accentLight : "transparent",
                      border: isSelected ? `1px solid ${tokens.accent}` : "1px solid transparent",
                      borderRadius: "6px",
                      cursor: "pointer",
                      color: isSelected ? tokens.accentText : tokens.text,
                      fontWeight: isSelected ? 600 : 400,
                      transition: "all 0.15s"
                    }}
                    onMouseOver={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isDark ? "#222" : "#f3f4f6";
                        e.currentTarget.style.color = tokens.textActive;
                      }
                    }}
                    onMouseOut={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = tokens.text;
                      }
                    }}
                  >
                    {/* Layer Type Icon Tag */}
                    <span
                      style={{
                        fontSize: "9px",
                        fontWeight: "bold",
                        padding: "2px 4px",
                        background: box.type === "text" ? "#3b82f6" : "#10b981",
                        color: "#fff",
                        borderRadius: "3px",
                        textTransform: "uppercase",
                        lineHeight: 1
                      }}
                    >
                      {box.type}
                    </span>
                    <span style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                      {box.id.replace("box-", "")}
                    </span>

                    {/* Locked Indicator */}
                    {box.locked && (
                      <span style={{ fontSize: "11px", color: tokens.text }}>🔒</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div style={{ padding: "16px" }}>
            <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: tokens.text, marginBottom: "12px", letterSpacing: "0.5px" }}>
              Quick Tools
            </h2>
            
            <div
              style={{
                background: tokens.cardBg,
                borderRadius: "8px",
                padding: "12px",
                border: `1px solid ${tokens.border}`,
                transition: "background-color 0.2s, border-color 0.2s"
              }}
            >
              <div style={{ fontSize: "12px", color: tokens.text, marginBottom: "8px", textAlign: "left" }}>
                Discount font size:{" "}
                <strong style={{ color: tokens.textActive }}>
                  {discountBox?.type === "text"
                    ? `${discountBox.fontSize}px`
                    : "N/A"}
                </strong>
              </div>
              
              <button
                onClick={() =>
                  updateTextBox("box-discount", {
                    fontSize: 72,
                  })
                }
                style={{
                  width: "100%",
                  padding: "8px",
                  backgroundColor: tokens.toolBtnBg,
                  border: `1px solid ${tokens.toolBtnBorder}`,
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: tokens.textActive,
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.accent;
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = tokens.toolBtnBg;
                  e.currentTarget.style.color = tokens.textActive;
                }}
              >
                Set Discount Size to 72px
              </button>
            </div>
            
            {/* Keyboard Shortcuts Cheat Sheet */}
            <div
              style={{
                marginTop: "20px",
                fontSize: "11px",
                color: tokens.text,
                textAlign: "left"
              }}
            >
              <div style={{ fontWeight: "bold", color: tokens.textActive, marginBottom: "6px" }}>Keyboard Controls:</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Arrow Keys</span>
                <span>Move 1px</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Shift + Arrows</span>
                <span>Move 10px</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Center Panel - Workbench & Canvas View */}
        <main
          style={{
            flex: 1,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "32px",
            overflow: "auto",
            boxSizing: "border-box",
            // Dynamic checkboard style grid pattern
            backgroundImage: `radial-gradient(${tokens.gridDot} 1px, transparent 0)`,
            backgroundSize: "24px 24px",
            transition: "background-image 0.2s"
          }}
        >
          {/* Canvas Wrapper Card */}
          <div
            style={{
              padding: "12px",
              background: tokens.panelBg,
              borderRadius: "10px",
              border: `1px solid ${tokens.border}`,
              boxShadow: tokens.shadow,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              transition: "all 0.2s"
            }}
          >
            <CanvasEditor
              width={600}
              height={800}
              template={template}
              previewData={mockPreviewData}
            />
          </div>
        </main>

        {/* Right Sidebar - Properties Panel wrapper */}
        <aside
          style={{
            background: tokens.panelBg,
            borderLeft: `1px solid ${tokens.border}`,
            height: "100%",
            overflowY: "auto",
            transition: "background-color 0.2s, border-color 0.2s"
          }}
        >
          {/* Inject styling overrides to customize the properties panel to match the light/dark design token variables */}
          <style>{`
            /* properties sidebar overrides */
            aside h2, aside h3 {
              color: ${tokens.textActive} !important;
              transition: color 0.2s;
            }
            aside div {
              color: ${tokens.text} !important;
              border-color: ${tokens.border} !important;
              background-color: ${tokens.panelBg} !important;
              transition: all 0.2s;
            }
            aside strong {
              color: ${tokens.textActive} !important;
              transition: color 0.2s;
            }
            aside hr {
              border-color: ${tokens.border} !important;
              transition: border-color 0.2s;
            }
          `}</style>
          <PropertiesPanel />
        </aside>
      </div>
    </div>
  );
}

export default App;