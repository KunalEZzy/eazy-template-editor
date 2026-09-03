import { useState } from "react";

export interface PropertyInputProps {
  label?: string;
  value: number;
  step?: string;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  style?: React.CSSProperties;
}

function formatNumber(value: number, step: string): string {
  if (step.includes(".")) {
    const decimals = step.split(".")[1]?.length ?? 0;
    return parseFloat(value.toFixed(decimals)).toString();
  }

  return value.toString();
}

export function PropertyInput({
  label,
  value,
  step = "0.1",
  min,
  max,
  onChange,
  style,
}: PropertyInputProps) {
  const [prevValue, setPrevValue] = useState(value);
  const [localVal, setLocalVal] = useState(() => formatNumber(value, step));

  // Sync state when external prop value changes without triggering cascading render warnings in useEffect
  if (prevValue !== value) {
    setPrevValue(value);
    setLocalVal(formatNumber(value, step));
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setLocalVal(raw);

    const parsed = parseFloat(raw);
    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed = parseFloat(localVal);

    if (Number.isNaN(parsed)) {
      setLocalVal(formatNumber(value, step));
      return;
    }

    onChange(parsed);
    setLocalVal(formatNumber(parsed, step));
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        position: "relative",
        width: "100%",
        ...style,
      }}
    >
      {label && (
        <span
          style={{
            position: "absolute",
            left: "8px",
            fontSize: "10px",
            fontWeight: 700,
            color: "var(--text)",
            pointerEvents: "none",
          }}
        >
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
        style={{
          paddingLeft: label ? "24px" : "8px",
        }}
      />
    </div>
  );
}

// --------------------------------------------------
// Text property input
// --------------------------------------------------

export interface PropertyTextInputProps {
  value: string;
  onChange: (val: string) => void;
  style?: React.CSSProperties;
}

export function PropertyTextInput({
  value,
  onChange,
  style,
}: PropertyTextInputProps) {
  const [prevValue, setPrevValue] = useState(value);
  const [localVal, setLocalVal] = useState(value);

  if (prevValue !== value) {
    setPrevValue(value);
    setLocalVal(value);
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
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