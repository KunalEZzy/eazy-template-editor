import { useEditorStore } from "../store/editorStore";

export function PropertiesPanel() {
  const template = useEditorStore(
    (state) => state.template
  );

  const selectedBoxId = useEditorStore(
    (state) => state.selectedBoxId
  );

  if (!template || !selectedBoxId) {
    return (
      <div
        style={{
          width: "280px",
          padding: "20px",
          borderLeft: "1px solid #ddd",
        }}
      >
        <h2>Properties</h2>
        <p>Select an element to edit.</p>
      </div>
    );
  }

  const box = template.boxes.find(
    (item) => item.id === selectedBoxId
  );

  if (!box) {
    return (
      <div
        style={{
          width: "280px",
          padding: "20px",
          borderLeft: "1px solid #ddd",
        }}
      >
        <h2>Properties</h2>
        <p>Selected element not found.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "280px",
        padding: "20px",
        borderLeft: "1px solid #ddd",
      }}
    >
      <h2>Properties</h2>

      <hr />

      <h3>Element</h3>

      <p>
        <strong>ID:</strong> {box.id}
      </p>

      <p>
        <strong>Type:</strong> {box.type}
      </p>

      {"variable" in box && (
        <p>
          <strong>Variable:</strong>{" "}
          {box.variable}
        </p>
      )}

      <hr />

      <h3>Position</h3>

      <p>
        <strong>X:</strong>{" "}
        {box.x.toFixed(2)}%
      </p>

      <p>
        <strong>Y:</strong>{" "}
        {box.y.toFixed(2)}%
      </p>

      <hr />

      <h3>Size</h3>

      <p>
        <strong>Width:</strong>{" "}
        {box.width.toFixed(2)}%
      </p>

      <p>
        <strong>Height:</strong>{" "}
        {box.height.toFixed(2)}%
      </p>

      <hr />

      <h3>Appearance</h3>

      <p>
        <strong>Rotation:</strong>{" "}
        {box.rotation}°
      </p>

      <p>
        <strong>Opacity:</strong>{" "}
        {box.opacity}
      </p>

      {"fontFamily" in box && (
        <>
          <hr />

          <h3>Typography</h3>

          <p>
            <strong>Font:</strong>{" "}
            {box.fontFamily}
          </p>

          <p>
            <strong>Font Size:</strong>{" "}
            {box.fontSize}px
          </p>

          <p>
            <strong>Font Weight:</strong>{" "}
            {box.fontWeight}
          </p>

          <p>
            <strong>Color:</strong>{" "}
            {box.color}
          </p>

          <p>
            <strong>Alignment:</strong>{" "}
            {box.textAlign}
          </p>
        </>
      )}
    </div>
  );
}