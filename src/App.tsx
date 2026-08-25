import { useEffect } from "react";

import { mockTemplate } from "./domain/template/template.mock";
import { useEditorStore } from "./store/editorStore";

function App() {
  const template = useEditorStore((state) => state.template);
  const selectedBoxId = useEditorStore(
    (state) => state.selectedBoxId
  );
  const isDirty = useEditorStore((state) => state.isDirty);

  const setTemplate = useEditorStore(
    (state) => state.setTemplate
  );

  const selectBox = useEditorStore(
    (state) => state.selectBox
  );

  const markDirty = useEditorStore(
    (state) => state.markDirty
  );

  useEffect(() => {
    setTemplate(mockTemplate);
  }, [setTemplate]);

  if (!template) {
    return <div>Loading template...</div>;
  }

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

      <button onClick={markDirty}>
        Simulate Change
      </button>
    </div>
  );
}

export default App;