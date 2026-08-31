import {
  useEffect,
  useState,
} from "react";

export interface PropertyInputProps {
  label?: string;
  value: number;
  step?: string;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  style?: React.CSSProperties;
}

function formatNumber(
  value: number,
  step: string
): string {
  if (step.includes(".")) {
    const decimals =
      step.split(".")[1]?.length ?? 0;

    return parseFloat(
      value.toFixed(decimals)
    ).toString();
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
  const [
    localVal,
    setLocalVal,
  ] = useState(() =>
    formatNumber(value, step)
  );

  /*
   * We only synchronize when the external
   * value has actually changed.
   *
   * This is needed because the value can change
   * from:
   * - mouse drag
   * - keyboard movement
   * - another property
   * - selecting another object
   */
  useEffect(() => {
    const parsed =
      parseFloat(localVal);

    if (
      Number.isNaN(parsed) ||
      Math.abs(
        parsed - value
      ) > 0.001
    ) {
      setLocalVal(
        formatNumber(
          value,
          step
        )
      );
    }
  }, [value, step, localVal]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw =
      event.target.value;

    setLocalVal(raw);

    const parsed =
      parseFloat(raw);

    if (!Number.isNaN(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const parsed =
      parseFloat(localVal);

    if (Number.isNaN(parsed)) {
      setLocalVal(
        formatNumber(
          value,
          step
        )
      );

      return;
    }

    onChange(parsed);

    setLocalVal(
      formatNumber(
        parsed,
        step
      )
    );
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
          paddingLeft:
            label
              ? "24px"
              : "8px",
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
  const [
    localVal,
    setLocalVal,
  ] = useState(value);

  useEffect(() => {
    if (localVal !== value) {
      setLocalVal(value);
    }
  }, [value, localVal]);

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const raw =
      event.target.value;

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