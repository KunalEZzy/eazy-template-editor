import { useEffect } from "react";

import { mockTemplate } from "./domain/template/template.mock";
import { useEditorStore } from "./store/editorStore";
import { EditorService } from "./editor/editor.service";
import { LocalTemplateRepository } from "./repository/LocalTemplateRepository";
import { EditorLayout } from "./components/layout/EditorLayout";

const repository = new LocalTemplateRepository();

const editorService = new EditorService(
  repository
);

const TEMPLATE_ID = mockTemplate.id;
const RESET_TEMPLATE_FOR_TEST = true;

function App() {
  const template = useEditorStore(
    (state) => state.template
  );

  const setTemplate = useEditorStore(
    (state) => state.setTemplate
  );

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