import { useEffect, useState, useRef } from "react";
import { useEditorStore } from "../../store/editorStore";
import { CanvasEditor } from "../../canvas/CanvasEditor";
import { mockPreviewData } from "../../domain/variables/preview.mock";
import { EditorService } from "../../editor/editor.service";
import { LocalTemplateRepository } from "../../repository/LocalTemplateRepository";
import { EditorHeader } from "./EditorHeader";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";
import { calculateCanvasDisplaySize } from "../../utils/canvasDimensions";

const repository = new LocalTemplateRepository();
const editorService = new EditorService(repository);

const MAIN_PADDING = 32;

export function EditorLayout() {
  const template = useEditorStore((state) => state.template);
  const selectedBoxId = useEditorStore((state) => state.selectedBoxId);
  const isSaving = useEditorStore((state) => state.isSaving);
  const isDirty = useEditorStore((state) => state.isDirty);
  const temporaryBackgroundImageUrl = useEditorStore(
    (state) => state.temporaryBackgroundImageUrl
  );
  const setTemplate = useEditorStore((state) => state.setTemplate);
  const selectBox = useEditorStore((state) => state.selectBox);
  const updateTextBox = useEditorStore((state) => state.updateTextBox);
  const setSaving = useEditorStore((state) => state.setSaving);
  const setError = useEditorStore((state) => state.setError);
  const deleteBox = useEditorStore((state) => state.deleteBox);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

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

  const [availableWorkspace, setAvailableWorkspace] = useState({
    width: 0,
    height: 0,
  });

  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem("eazy-theme", next ? "dark" : "light");
      return next;
    });
  };

  const handleSave = async () => {
    if (!template || !isDirty) {
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const templateToSave =
        temporaryBackgroundImageUrl !== null
          ? {
              ...template,
              background: {
                ...template.background,
                imageUrl: temporaryBackgroundImageUrl,
              },
            }
          : template;

      const savedTemplate = await editorService.saveTemplate(templateToSave);
      setTemplate(savedTemplate);
    } catch (error) {
      console.error("Failed to save template:", error);
      setError(
        error instanceof Error ? error.message : "Failed to save template"
      );
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const modifierKey = isMac ? event.metaKey : event.ctrlKey;

      if (!modifierKey) {
        return;
      }

      // Undo: Cmd + Z / Ctrl + Z
      if (event.key.toLowerCase() === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // Redo: Cmd + Shift + Z / Ctrl + Shift + Z
      if (event.key.toLowerCase() === "z" && event.shiftKey) {
        event.preventDefault();
        redo();
        return;
      }

      // Redo: Ctrl + Y (Windows/Linux)
      if (!isMac && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [undo, redo]);

  useEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) {
      return;
    }

    const updateWorkspaceSize = () => {
      const rect = workspace.getBoundingClientRect();
      const width = Math.max(0, Math.floor(rect.width - MAIN_PADDING * 2));
      const height = Math.max(0, Math.floor(rect.height - MAIN_PADDING * 2));

      setAvailableWorkspace((previous) => {
        if (previous.width === width && previous.height === height) {
          return previous;
        }
        return { width, height };
      });
    };

    updateWorkspaceSize();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const width = Math.floor(entry.contentRect.width);
      const height = Math.floor(entry.contentRect.height);

      setAvailableWorkspace((previous) => {
        if (previous.width === width && previous.height === height) {
          return previous;
        }
        return { width, height };
      });
    });

    observer.observe(workspace);

    return () => {
      observer.disconnect();
    };
  }, []);

  if (!template) {
    return null;
  }

  const canvasDisplaySize = calculateCanvasDisplaySize({
    documentWidth: template.settings.canvasWidth,
    documentHeight: template.settings.canvasHeight,
    availableWidth: availableWorkspace.width,
    availableHeight: availableWorkspace.height,
  });

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
      : "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
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
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
        backgroundColor: tokens.bg,
        color: tokens.text,
        transition: "background-color 0.2s, color 0.2s",
      }}
    >
      {/* Top Navigation Bar */}
      <EditorHeader
        template={template}
        selectedBoxId={selectedBoxId}
        isDirty={isDirty}
        isSaving={isSaving}
        isDark={isDark}
        tokens={tokens}
        onToggleTheme={toggleTheme}
        onSave={handleSave}
      />

      {/* Main Workspace Frame */}
      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          background: tokens.bg,
          transition: "background-color 0.2s",
        }}
      >
        {/* Left Sidebar: Layers list & Action Panel */}
        <LeftSidebar
          template={template}
          selectedBoxId={selectedBoxId}
          isDark={isDark}
          tokens={tokens}
          onSelectBox={selectBox}
          onUpdateTextBox={updateTextBox}
          onDeleteBox={deleteBox}
        />

        {/* Center Panel - Workbench & Canvas View */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            position: "relative",
            overflow: "hidden",
            boxSizing: "border-box",
            backgroundImage: `radial-gradient(${tokens.gridDot} 1px, transparent 0)`,
            backgroundSize: "24px 24px",
            transition: "background-color 0.2s, background-image 0.2s",
          }}
        >
          {/* Inner measurement & alignment container */}
          <div
            ref={workspaceRef}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              width: "100%",
              height: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: `${MAIN_PADDING}px`,
              overflow: "hidden",
              boxSizing: "border-box",
            }}
          >
            {canvasDisplaySize.scale > 0 && (
              /* DISPLAY VIEWPORT: Sized to scaled dimensions */
              <div
                style={{
                  width: `${canvasDisplaySize.width}px`,
                  height: `${canvasDisplaySize.height}px`,
                  position: "relative",
                  borderRadius: "10px",
                  border: `1px solid ${tokens.border}`,
                  boxShadow: tokens.shadow,
                  overflow: "hidden",
                  background: tokens.panelBg,
                  flexShrink: 0,
                  transition:
                    "border-color 0.2s, box-shadow 0.2s, background-color 0.2s",
                }}
              >
                {/* DOCUMENT SCALE CONTAINER: Document dimensions scaled visually via CSS */}
                <div
                  style={{
                    width: `${template.settings.canvasWidth}px`,
                    height: `${template.settings.canvasHeight}px`,
                    transform: `scale(${canvasDisplaySize.scale})`,
                    transformOrigin: "top left",
                    position: "absolute",
                    top: 0,
                    left: 0,
                  }}
                >
                  <CanvasEditor
                    template={template}
                    previewData={mockPreviewData}
                  />
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Properties Panel wrapper */}
        <RightSidebar tokens={tokens} />
      </div>
    </div>
  );
}
