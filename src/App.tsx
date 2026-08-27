import { useEffect } from "react";

import { mockTemplate } from "./domain/template/template.mock";
import { useEditorStore } from "./store/editorStore";
import { CanvasEditor } from "./canvas/CanvasEditor";
import { mockPreviewData } from "./domain/variables/preview.mock";
import { EditorService } from "./editor/editor.service";
import { LocalTemplateRepository } from "./repository/LocalTemplateRepository";


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
    return <div>Loading template...</div>;
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

  return (
    <div style={{ padding: "40px" }}>
      <h1>{template.name}</h1>

      <p>
        Campaign: {template.campaign}
      </p>

      <p>
        Boxes: {template.boxes.length}
      </p>

      <p>
        Selected box:{" "}
        {selectedBoxId ?? "None"}
      </p>

      <p>
        Status:{" "}
        {isDirty ? "Unsaved changes" : "Saved"}
      </p>

      <button
        onClick={handleSave}
        disabled={!isDirty || isSaving}
      >
        {isSaving ? "Saving..." : "Save"}
      </button>

      <p>
        Discount font size:{" "}
        {discountBox?.type === "text"
          ? discountBox.fontSize
          : "N/A"}
      </p>



      <hr />

      <CanvasEditor
        width={600}
        height={800}
        template={template}
        previewData={mockPreviewData}
      />
      <hr />

      <h2>Layers</h2>

      {template.boxes.map((box) => (
        <button
          key={box.id}
          onClick={() => selectBox(box.id)}
          style={{
            display: "block",
            marginBottom: "8px",
          }}
        >
          {box.type} — {box.id}
        </button>
      ))}

      <hr />

      <button
        onClick={() =>
          updateTextBox("box-discount", {
            fontSize: 72,
          })
        }
      >
        Increase Discount Font
      </button>
    </div>
  );
}

export default App;