import { useEditorStore } from "./store/editorStore";
import { EditorLayout } from "./components/layout/EditorLayout";
import { useEditorToken } from "./hooks/useEditorToken";
import { useEffect } from "react";
import { mockTemplate } from "./domain/template/template.mock";
import { mockPreviewData } from "./domain/variables/preview.mock";
import { EditorService } from "./editor/editor.service";
import { LocalTemplateRepository } from "./repository/LocalTemplateRepository";
import { TemplateNotFoundError } from "./repository/TemplateRepository";
import type { Template } from "./domain/template/template.types";

const editorService = new EditorService(new LocalTemplateRepository());

function App() {
  const template = useEditorStore(
    (state) => state.template
  );

  const error = useEditorStore(
    (state) => state.error
  );

  const setTemplate = useEditorStore((s) => s.setTemplate);
  const setPreviewData = useEditorStore((s) => s.setPreviewData);
  const setError = useEditorStore((s) => s.setError);

  // Reads ?token= from the URL, fetches this restaurant's variables
  // from Laravel, and populates the store (template + previewData).
  useEditorToken();

  // Standalone bootstrap: hydrate the persisted template through the existing
  // service/repository layer. Fall back to the bundled mock only when the
  // template does not exist yet; any other repository failure is surfaced.
  useEffect(() => {
    const hasToken = new URLSearchParams(window.location.search).has("token");
    if (hasToken) return;

    let cancelled = false;
    setError(null);

    async function bootstrap() {
      let loaded: Template;

      try {
        loaded = await editorService.loadTemplate(mockTemplate.id);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (error instanceof TemplateNotFoundError) {
          loaded = mockTemplate;
        } else {
          setError(
            error instanceof Error
              ? error.message
              : "Could not load your template data."
          );
          return;
        }
      }

      if (cancelled) {
        return;
      }

      setTemplate(loaded);
      setPreviewData(mockPreviewData);
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [setTemplate, setPreviewData, setError]);

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

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily: "system-ui, sans-serif",
          color: "#f87171",
          background: "#121212",
          textAlign: "center",
          padding: "24px"
        }}
      >
        {error}
      </div>
    );
  }

  if (!template) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          fontFamily: "system-ui, sans-serif",
          color: "#9ca3af",
          background: "#121212"
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

  return <EditorLayout />;
}

export default App;