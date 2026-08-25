import { useEditorStore } from "./store/editorStore";

function App() {
  const zoom = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);

  return (
    <div style={{ padding: "40px" }}>
      <h1>Template Editor</h1>

      <p>Zoom: {Math.round(zoom * 100)}%</p>

      <button onClick={() => setZoom(zoom + 0.1)}>
        Zoom In
      </button>

      <button onClick={() => setZoom(zoom - 0.1)}>
        Zoom Out
      </button>
    </div>
  );
}

export default App;