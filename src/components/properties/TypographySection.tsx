import type { TextBox } from "../../domain/box/box.types";
import {
  PropertyInput,
  PropertyTextInput,
} from "./PropertyInput";

interface TypographySectionProps {
  box: TextBox;
  updateTextBox: (
    boxId: string,
    changes: Partial<
      Omit<TextBox, "id" | "type">
    >
  ) => void;
}

const TEXT_ALIGN_OPTIONS: TextBox["textAlign"][] = [
  "left",
  "center",
  "right",
];

export function TypographySection({
  box,
  updateTextBox,
}: TypographySectionProps) {
  return (
    <div>
      <h3
        style={{
          fontSize: "11px",
          fontWeight: 700,
          margin: "0 0 8px",
          color: "var(--text-h)",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        Typography
      </h3>

      {/* Font Family */}
      <div style={{ marginBottom: "8px" }}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          <span
            style={{
              fontSize: "9px",
              fontWeight: 700,
              color: "var(--text)",
              textAlign: "left",
            }}
          >
            FONT FAMILY
          </span>

          <select
            className="prop-input prop-select"
            value={box.fontFamily}
            onChange={(e) =>
              updateTextBox(box.id, {
                fontFamily: e.target.value,
              })
            }
          >
            <option value="Arial">
              Arial
            </option>

            <option value="Helvetica">
              Helvetica
            </option>

            <option value="Times New Roman">
              Times New Roman
            </option>

            <option value="Courier New">
              Courier New
            </option>

            <option value="Georgia">
              Georgia
            </option>

            <option value="Verdana">
              Verdana
            </option>
          </select>
        </div>
      </div>

      {/* Size & Weight */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "var(--text)",
                textAlign: "left",
              }}
            >
              SIZE (PX)
            </span>

            <PropertyInput
              value={box.fontSize}
              step="1"
              min={1}
              onChange={(val) =>
                updateTextBox(
                  box.id,
                  {
                    fontSize: val,
                  }
                )
              }
            />
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "var(--text)",
                textAlign: "left",
              }}
            >
              WEIGHT
            </span>

            <select
              className="prop-input prop-select"
              value={box.fontWeight}
              onChange={(e) =>
                updateTextBox(box.id, {
                  fontWeight:
                    Number(
                      e.target.value
                    ),
                })
              }
            >
              <option value={300}>
                Light (300)
              </option>

              <option value={400}>
                Normal (400)
              </option>

              <option value={500}>
                Medium (500)
              </option>

              <option value={700}>
                Bold (700)
              </option>

              <option value={900}>
                Black (900)
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Color & Alignment */}
      <div
        style={{
          display: "flex",
          gap: "8px",
        }}
      >
        {/* Color */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "var(--text)",
                textAlign: "left",
              }}
            >
              COLOR
            </span>

            <div
              style={{
                display: "flex",
                gap: "4px",
              }}
            >
              <input
                type="color"
                value={box.color}
                onChange={(e) =>
                  updateTextBox(
                    box.id,
                    {
                      color:
                        e.target.value,
                    }
                  )
                }
                style={{
                  width: "24px",
                  height: "28px",
                  padding: 0,
                  border:
                    "1px solid var(--border)",
                  borderRadius: "6px",
                  cursor: "pointer",
                  background:
                    "transparent",
                }}
              />

              <PropertyTextInput
                value={box.color}
                onChange={(val) =>
                  updateTextBox(
                    box.id,
                    {
                      color: val,
                    }
                  )
                }
                style={{
                  flex: 1,
                  textTransform:
                    "uppercase",
                  textAlign: "center",
                }}
              />
            </div>
          </div>
        </div>

        {/* Alignment */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <span
              style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "var(--text)",
                textAlign: "left",
              }}
            >
              ALIGN
            </span>

            <select
              className="prop-input prop-select"
              value={box.textAlign}
              onChange={(e) => {
                const value =
                  e.target.value;

                if (
                  TEXT_ALIGN_OPTIONS.includes(
                    value as TextBox["textAlign"]
                  )
                ) {
                  updateTextBox(
                    box.id,
                    {
                      textAlign:
                        value as TextBox["textAlign"],
                    }
                  );
                }
              }}
            >
              <option value="left">
                Left
              </option>

              <option value="center">
                Center
              </option>

              <option value="right">
                Right
              </option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}