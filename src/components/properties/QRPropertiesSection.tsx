import type { QRBox } from "../../domain/box/box.types";

interface QRPropertiesSectionProps {
  box: QRBox;
}

export function QRPropertiesSection({
  box,
}: QRPropertiesSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <h3
        style={{
          fontSize: "11px",
          fontWeight: 700,
          margin: 0,
          color: "var(--text-h)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        QR Properties
      </h3>

      {/* QR Variable */}
      <div>
        <span
          style={{
            display: "block",
            fontSize: "9px",
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: "4px",
            textAlign: "left",
          }}
        >
          VARIABLE
        </span>

        <div
          style={{
            padding: "7px 10px",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            background: "rgba(124, 58, 237, 0.08)",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "var(--text-h)",
          }}
        >
          {box.variable}
        </div>
      </div>
    </div>
  );
}
