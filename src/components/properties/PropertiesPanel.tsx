import { useEditorStore } from "../../store/editorStore";
import { GeometrySection } from "./GeometrySection";
import { TypographySection } from "./TypographySection";
import { BackgroundSection } from "./BackgroundSection";
import { QRPropertiesSection } from "./QRPropertiesSection";

export function PropertiesPanel() {
  const template = useEditorStore((state) => state.template);
  const selectedBoxId = useEditorStore((state) => state.selectedBoxId);
  const updateBoxTransform = useEditorStore((state) => state.updateBoxTransform);
  const updateTextBox = useEditorStore((state) => state.updateTextBox);
  const updateQRBox = useEditorStore((state) => state.updateQRBox);

  // Return a clean placeholder if no template or selection is active
  if (!template || !selectedBoxId) {
    return (
      <div
        className="properties-panel"
        style={{
          width: "100%",
          padding: "20px 16px",
          boxSizing: "border-box",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "var(--text)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>🎛️</div>
        <h2 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 4px", color: "var(--text-h)" }}>
          No Selection
        </h2>
        <p style={{ fontSize: "12px", margin: 0, color: "var(--text)", maxWidth: "200px" }}>
          Select any template element or layer to inspect and edit its properties.
        </p>
      </div>
    );
  }

  const box = template.boxes.find((item) => item.id === selectedBoxId);

  if (!box) {
    return (
      <div
        className="properties-panel"
        style={{
          width: "100%",
          padding: "20px 16px",
          boxSizing: "border-box",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "var(--text)",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "28px", marginBottom: "8px" }}>⚠️</div>
        <h2 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 4px", color: "var(--text-h)" }}>
          Not Found
        </h2>
        <p style={{ fontSize: "12px", margin: 0, color: "var(--text)" }}>
          Selected element not found in template.
        </p>
      </div>
    );
  }

  return (
    <div
      className="properties-panel"
      style={{
        width: "100%",
        padding: "16px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Inject custom styling rules for our inputs */}
      <style>{`
        .prop-input {
          width: 100%;
          padding: 6px 8px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: #f9fafb;
          color: #111827;
          background: var(--input-bg);
          color: var(--input-text);
          font-size: 12px;
          font-weight: 500;
          box-sizing: border-box;
          outline: none;
          text-align: right;
          transition: all 0.15s ease;
        }
        .theme-dark .prop-input {
          background: #242424;
          color: #ffffff;
        }
        .theme-light .prop-input {
          background: #f9fafb;
          color: #111827;
        }
        .prop-input:focus {
          border-color: #7c3aed;
          background: transparent;
          box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.12);
        }
        .prop-select {
          appearance: none;
          text-align-last: right;
          padding-right: 20px;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'><path fill='%23666' d='M0 0l4 4 4-4z'/></svg>");
          background-repeat: no-repeat;
          background-position: right 8px center;
        }
        .prop-select option {
          background: #ffffff;
          color: #111827;
        }
        .theme-dark .prop-select option {
          background: #181818;
          color: #ffffff;
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", paddingBottom: "10px", borderBottom: "1px solid var(--border)" }}>
        <span style={{ fontSize: "16px" }}>⚙️</span>
        <h2 style={{ fontSize: "14px", fontWeight: 600, margin: 0, color: "var(--text-h)" }}>
          Properties
        </h2>
      </div>

      {/* Meta Information */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)" }}>ELEMENT ID</span>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-h)", background: "rgba(124, 58, 237, 0.1)", padding: "2px 6px", borderRadius: "4px" }}>
            {box.id}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)" }}>TYPE</span>
          <span style={{ fontSize: "11px", fontWeight: 500, color: "var(--text-h)", textTransform: "uppercase" }}>
            {box.type}
          </span>
        </div>
        {"variable" in box && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--text)" }}>VARIABLE</span>
            <code style={{ fontSize: "10px", padding: "2px 4px", background: "rgba(124, 58, 237, 0.08)", borderRadius: "4px" }}>
              {box.variable}
            </code>
          </div>
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0 }} />

      {/* Geometry Section */}
      <GeometrySection box={box} updateBoxTransform={updateBoxTransform} />

      {/* Typography Section — only for text boxes */}
      {box.type === "text" && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0 }} />
          <TypographySection box={box} updateTextBox={updateTextBox} />
        </>
      )}

      {/* QR Properties Section — only for QR boxes */}
      {box.type === "qr" && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0 }} />
          <QRPropertiesSection box={box} updateQRBox={updateQRBox} />
        </>
      )}

      {/* Background Section */}
      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0 }} />
      <BackgroundSection />
    </div>
  );
}
