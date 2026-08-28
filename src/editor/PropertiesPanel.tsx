import { useEffect, useState } from "react";
import { useEditorStore } from "../store/editorStore";

// Reusable local state wrapper for numeric inputs to avoid snapping back when cleared/empty
interface PropertyInputProps {
  label?: string;
  value: number;
  step?: string;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  style?: React.CSSProperties;
}

function PropertyInput({ label, value, step = "0.1", min, max, onChange, style }: PropertyInputProps) {
  const [localVal, setLocalVal] = useState<string>(value.toString());

  // Keep local state in sync with changes from other sources (e.g. mouse drags, keyboard keys)
  useEffect(() => {
    const parsedLocal = parseFloat(localVal);
    // Use an epsilon comparison for floating-point coordinates (e.g. diff < 0.01)
    const hasChanged = isNaN(parsedLocal) || Math.abs(parsedLocal - value) > 0.001;
    if (hasChanged) {
      // Format coordinate decimals cleanly (e.g. limit to 1 decimal place if it's layout)
      const formatted = step.includes(".") 
        ? parseFloat(value.toFixed(step.split(".")[1].length)).toString()
        : value.toString();
      setLocalVal(formatted);
    }
  }, [value, step]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalVal(raw);
    
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(localVal);
    if (isNaN(parsed)) {
      setLocalVal(value.toString());
    } else {
      onChange(parsed);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", position: "relative", width: "100%", ...style }}>
      {label && (
        <span style={{ position: "absolute", left: "8px", fontSize: "10px", fontWeight: 700, color: "var(--text)", pointerEvents: "none" }}>
          {label}
        </span>
      )}
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        className="prop-input"
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
        style={{ paddingLeft: label ? "24px" : "8px" }}
      />
    </div>
  );
}

// Reusable local state wrapper for text fields (like Hex colors) to avoid reset snapping
interface PropertyTextInputProps {
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
}

function PropertyTextInput({ value, onChange, style }: PropertyTextInputProps) {
  const [localVal, setLocalVal] = useState<string>(value);

  useEffect(() => {
    if (localVal !== value) {
      setLocalVal(value);
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setLocalVal(raw);
    onChange(raw);
  };

  return (
    <input
      type="text"
      className="prop-input"
      value={localVal}
      onChange={handleChange}
      style={style}
    />
  );
}

export function PropertiesPanel() {
  const template = useEditorStore(
    (state) => state.template
  );

  const selectedBoxId = useEditorStore(
    (state) => state.selectedBoxId
  );

  const updateBoxTransform = useEditorStore(
    (state) => state.updateBoxTransform
  );

  const updateTextBox = useEditorStore(
    (state) => state.updateTextBox
  );

  // Return a clean placeholder if no template or selection is active
  if (!template || !selectedBoxId) {
    return (
      <div
        className="properties-panel"
        style={{
          width: "280px",
          padding: "16px",
          borderLeft: "1px solid var(--border)",
          boxSizing: "border-box",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "var(--text)",
          textAlign: "center"
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>🎛️</div>
        <h2 style={{ fontSize: "14px", fontWeight: 600, margin: "0 0 4px", color: "var(--text-h)" }}>
          No Selection
        </h2>
        <p style={{ fontSize: "12px", margin: 0, color: "var(--text)", maxWidth: "180px" }}>
          Select any template layer to inspect and edit properties.
        </p>
      </div>
    );
  }

  const box = template.boxes.find(
    (item) => item.id === selectedBoxId
  );

  if (!box) {
    return (
      <div
        className="properties-panel"
        style={{
          width: "280px",
          padding: "16px",
          borderLeft: "1px solid var(--border)",
          boxSizing: "border-box",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          color: "var(--text)",
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>⚠️</div>
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
        width: "280px",
        padding: "16px",
        borderLeft: "1px solid var(--border)",
        boxSizing: "border-box",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        overflowY: "auto"
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
            <code style={{ fontSize: "10px", padding: "2px 4px" }}>
              {box.variable}
            </code>
          </div>
        )}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0 }} />

      {/* Layout / Dimensions Grid */}
      <div>
        <h3 style={{ fontSize: "11px", fontWeight: 700, margin: "0 0 8px", color: "var(--text-h)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          Geometry
        </h3>
        
        {/* Row 1: X & Y Position */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <div style={{ flex: 1 }}>
            <PropertyInput
              label="X"
              value={box.x}
              step="0.1"
              onChange={(val) => updateBoxTransform(box.id, { x: val })}
            />
          </div>
          <div style={{ flex: 1 }}>
            <PropertyInput
              label="Y"
              value={box.y}
              step="0.1"
              onChange={(val) => updateBoxTransform(box.id, { y: val })}
            />
          </div>
        </div>

        {/* Row 2: Width */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <div style={{ flex: 1 }}>
            <PropertyInput
              label="W"
              value={box.width}
              step="0.1"
              onChange={(val) => updateBoxTransform(box.id, { width: val })}
            />
          </div>
        </div>

        {/* Row 3: Rotation & Opacity */}
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <PropertyInput
              label="R"
              value={box.rotation}
              step="1"
              onChange={(val) => updateBoxTransform(box.id, { rotation: val })}
            />
          </div>
        </div>
      </div>

      {"fontFamily" in box && (
        <>
          <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: 0 }} />

          {/* Typography Inspector */}
          <div>
            <h3 style={{ fontSize: "11px", fontWeight: 700, margin: "0 0 8px", color: "var(--text-h)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Typography
            </h3>

            {/* Font Family (Dropdown Select) */}
            <div style={{ marginBottom: "8px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--text)", textAlign: "left" }}>FONT FAMILY</span>
                <select
                  className="prop-input prop-select"
                  value={box.fontFamily}
                  onChange={(e) => updateTextBox(box.id, { fontFamily: e.target.value })}
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Courier New">Courier New</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </div>
            </div>

            {/* Size & Weight */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--text)", textAlign: "left" }}>SIZE (PX)</span>
                  <PropertyInput
                    value={box.fontSize}
                    step="1"
                    min={1}
                    onChange={(val) => updateTextBox(box.id, { fontSize: val })}
                  />
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--text)", textAlign: "left" }}>WEIGHT</span>
                  <select
                    className="prop-input prop-select"
                    value={box.fontWeight}
                    onChange={(e) => updateTextBox(box.id, { fontWeight: parseInt(e.target.value, 10) })}
                  >
                    <option value={300}>Light (300)</option>
                    <option value={400}>Normal (400)</option>
                    <option value={500}>Medium (500)</option>
                    <option value={700}>Bold (700)</option>
                    <option value={900}>Black (900)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Color & Alignment */}
            <div style={{ display: "flex", gap: "8px" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--text)", textAlign: "left" }}>COLOR</span>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <input
                      type="color"
                      value={box.color}
                      onChange={(e) => updateTextBox(box.id, { color: e.target.value })}
                      style={{
                        width: "24px",
                        height: "28px",
                        padding: 0,
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        background: "transparent"
                      }}
                    />
                    <PropertyTextInput
                      value={box.color}
                      onChange={(val) => updateTextBox(box.id, { color: val })}
                      style={{ flex: 1, textTransform: "uppercase", textAlign: "center" }}
                    />
                  </div>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--text)", textAlign: "left" }}>ALIGN</span>
                  <select
                    className="prop-input prop-select"
                    value={box.textAlign}
                    onChange={(e) => updateTextBox(box.id, { textAlign: e.target.value as any })}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}