import { useEffect, useState } from "react";
import { useEditorStore } from "../../store/editorStore";
import { CanvasEditor } from "../../canvas/CanvasEditor";
import { mockPreviewData } from "../../domain/variables/preview.mock";
import { EditorService } from "../../editor/editor.service";
import { LocalTemplateRepository } from "../../repository/LocalTemplateRepository";
import { EditorHeader } from "./EditorHeader";
import { LeftSidebar } from "./LeftSidebar";
import { RightSidebar } from "./RightSidebar";

const repository = new LocalTemplateRepository();
const editorService = new EditorService(repository);

export function EditorLayout() {
  const template = useEditorStore((state) => state.template);
  console.log(
  "EDITOR LAYOUT BOXES:",
  template?.boxes.map((box) => ({
    id: box.id,
    type: box.type,
    variable:
      box.type === "text" || box.type === "qr"
        ? box.variable
        : null,
  }))
);
  const selectedBoxId = useEditorStore((state) => state.selectedBoxId);
  const isSaving = useEditorStore((state) => state.isSaving);
  const isDirty = useEditorStore((state) => state.isDirty);
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

    useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac =
        navigator.platform.toUpperCase().includes("MAC");

      const modifierKey = isMac
        ? event.metaKey
        : event.ctrlKey;

      if (!modifierKey) {
        return;
      }

      // --------------------------------------------
      // Undo
      // Cmd + Z / Ctrl + Z
      // --------------------------------------------

      if (
        event.key.toLowerCase() === "z" &&
        !event.shiftKey
      ) {
        event.preventDefault();
        undo();
        return;
      }

      // --------------------------------------------
      // Redo
      // Cmd + Shift + Z / Ctrl + Shift + Z
      // --------------------------------------------

      if (
        event.key.toLowerCase() === "z" &&
        event.shiftKey
      ) {
        event.preventDefault();
        redo();
        return;
      }

      // --------------------------------------------
      // Redo
      // Ctrl + Y
      //
      // Common Windows/Linux shortcut.
      // We don't use Cmd + Y on macOS.
      // --------------------------------------------

      if (
        !isMac &&
        event.key.toLowerCase() === "y"
      ) {
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [undo, redo]);

  if (!template) {
    return null;
  }

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
          transition: "background-color 0.2s"
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
        <RightSidebar tokens={tokens} />
      </div>
    </div>
  );
}
