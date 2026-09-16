import { useEffect, useState, useRef } from "react";
import { useEditorStore } from "../../store/editorStore";
import { CanvasEditor } from "../../canvas/CanvasEditor";
// import { mockPreviewData } from "../../domain/variables/preview.mock";
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
  const previewData = useEditorStore((state) => state.previewData);
  const selectedBoxId = useEditorStore((state) => state.selectedBoxId);
  const isSaving = useEditorStore((state) => state.isSaving);
  const isDirty = useEditorStore((state) => state.isDirty);
  const temporaryBackgroundImageUrl = useEditorStore(
    (state) => state.temporaryBackgroundImageUrl
  );
  const setTemplate = useEditorStore((state) => state.setTemplate);
  const selectBox = useEditorStore((state) => state.selectBox);
  const setSaving = useEditorStore((state) => state.setSaving);
  const deleteBox = useEditorStore((state) => state.deleteBox);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);

  const [availableWorkspace, setAvailableWorkspace] = useState({
    width: 0,
    height: 0,
  });

  const [saveError, setSaveError] = useState<string | null>(null);

  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const handleSave = async () => {
    if (!template || !isDirty) {
      return;
    }

    setSaveError(null);

    try {
      setSaving(true);

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
      setSaveError(
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

  const tokens = {
    bg: "#f3f4f6",
    panelBg: "#ffffff",
    border: "#e5e7eb",
    text: "#4b5563",
    textActive: "#111827",
    gridDot: "#d1d5db",
    accent: "#7c3aed",
    accentHover: "#6d28d9",
    accentLight: "#f3e8ff",
    accentText: "#6d28d9",
    cardBg: "#ffffff",
    toolBtnBg: "#f3f4f6",
    toolBtnBorder: "#e5e7eb",
    shadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
  };

  return (
    <div
      className="theme-light"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        maxHeight: "100vh",
        maxWidth: "100vw",
        position: "fixed",
        inset: 0,
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
        tokens={tokens}
        onSave={handleSave}
      />

      {saveError && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            padding: "8px 20px",
            background: "#fee2e2",
            borderBottom: `1px solid ${tokens.border}`,
            color: "#b91c1c",
            fontSize: "13px",
            textAlign: "center",
          }}
        >
          <span>
            Save failed — {saveError}. Your changes are still on the canvas;
            try again.
          </span>
        </div>
      )}

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
          tokens={tokens}
          onSelectBox={selectBox}
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
                    previewData={previewData}
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
