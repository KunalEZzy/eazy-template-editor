import { useEffect, useState } from "react";

// Reusable local state wrapper for numeric inputs to avoid snapping back when cleared/empty
export interface PropertyInputProps {
  label?: string;
  value: number;
  step?: string;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  style?: React.CSSProperties;
}

export function PropertyInput({ label, value, step = "0.1", min, max, onChange, style }: PropertyInputProps) {
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
export interface PropertyTextInputProps {
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
}

export function PropertyTextInput({ value, onChange, style }: PropertyTextInputProps) {
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
