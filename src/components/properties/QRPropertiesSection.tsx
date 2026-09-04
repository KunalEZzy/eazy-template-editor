import type { QRBox } from "../../domain/box/box.types";
import { PropertyTextInput } from "./PropertyInput";

interface QRPropertiesSectionProps {
  box: QRBox;
  updateQRBox: (
    boxId: string,
    changes: Partial<Omit<QRBox, "id" | "type">>
  ) => void;
}

export function QRPropertiesSection({
  box,
  updateQRBox,
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

      {/* Foreground & Background Colors */}
      <div style={{ display: "flex", gap: "8px" }}>
        {/* Foreground */}
        <div style={{ flex: 1 }}>
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
            FOREGROUND
          </span>

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="color"
              value={box.foregroundColor}
              onChange={(e) =>
                updateQRBox(box.id, {
                  foregroundColor: e.target.value,
                })
              }
              style={{
                width: "28px",
                height: "28px",
                padding: 0,
                border: "1px solid var(--border)",
                borderRadius: "6px",
                cursor: "pointer",
                background: "transparent",
                flexShrink: 0,
              }}
            />

            <PropertyTextInput
              value={box.foregroundColor}
              onChange={(value) =>
                updateQRBox(box.id, {
                  foregroundColor: value,
                })
              }
              style={{
                flex: 1,
                textTransform: "uppercase",
                textAlign: "center",
                fontSize: "11px",
              }}
            />
          </div>
        </div>

        {/* Background */}
        <div style={{ flex: 1 }}>
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
            BACKGROUND
          </span>

          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="color"
              value={box.backgroundColor}
              onChange={(e) =>
                updateQRBox(box.id, {
                  backgroundColor: e.target.value,
                })
              }
              style={{
                width: "28px",
                height: "28px",
                padding: 0,
                border: "1px solid var(--border)",
                borderRadius: "6px",
                cursor: "pointer",
                background: "transparent",
                flexShrink: 0,
              }}
            />

            <PropertyTextInput
              value={box.backgroundColor}
              onChange={(value) =>
                updateQRBox(box.id, {
                  backgroundColor: value,
                })
              }
              style={{
                flex: 1,
                textTransform: "uppercase",
                textAlign: "center",
                fontSize: "11px",
              }}
            />
          </div>
        </div>
      </div>

      {/* Logo URL */}
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
          LOGO URL (OPTIONAL)
        </span>

        <PropertyTextInput
          value={box.logoUrl ?? ""}
          onChange={(value) =>
            updateQRBox(box.id, {
              logoUrl: value.trim() || undefined,
            })
          }
          style={{
            textAlign: "left",
          }}
        />
      </div>
    </div>
  );
}