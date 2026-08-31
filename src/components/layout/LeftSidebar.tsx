import type { Template } from "../../domain/template/template.types";
import type { TextBox } from "../../domain/box/box.types";
import { LayersPanel } from "../layers/LayersPanel";
import type { DesignTokens } from "./EditorHeader";
import { VariablePicker } from "../variables/VariablePicker";

interface LeftSidebarProps {
  template: Template;
  selectedBoxId: string | null;
  isDark: boolean;
  tokens: DesignTokens;
  onSelectBox: (boxId: string | null) => void;
  onUpdateTextBox: (boxId: string, changes: Partial<Omit<TextBox, "id" | "type">>) => void;
}

export function LeftSidebar({
  template,
  selectedBoxId,
  isDark,
  tokens,
  onSelectBox,
  onUpdateTextBox,
}: LeftSidebarProps) {
  const discountBox = template.boxes.find((box) => box.id === "box-discount");

  return (
    <aside
      style={{
        width: "260px",
        borderRight: `1px solid ${tokens.border}`,
        background: tokens.panelBg,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        boxSizing: "border-box",
        transition: "background-color 0.2s, border-color 0.2s"
      }}
    >
      {/* Layers Section */}
      <LayersPanel
        boxes={template.boxes}
        selectedBoxId={selectedBoxId}
        isDark={isDark}
        tokens={tokens}
        onSelectBox={onSelectBox}
      />

      {/* Variable Section */}
      <div
        style={{
          padding: "16px",
          borderTop: `1px solid ${tokens.border}`,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <VariablePicker />
      </div>

      {/* Quick Actions Panel */}
      <div style={{ padding: "16px" }}>
        <h2 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: tokens.text, marginBottom: "12px", letterSpacing: "0.5px" }}>
          Quick Tools
        </h2>
        
        <div
          style={{
            background: tokens.cardBg,
            borderRadius: "8px",
            padding: "12px",
            border: `1px solid ${tokens.border}`,
            transition: "background-color 0.2s, border-color 0.2s"
          }}
        >
          <div style={{ fontSize: "12px", color: tokens.text, marginBottom: "8px", textAlign: "left" }}>
            Discount font size:{" "}
            <strong style={{ color: tokens.textActive }}>
              {discountBox?.type === "text"
                ? `${discountBox.fontSize}px`
                : "N/A"}
            </strong>
          </div>
          
          <button
            onClick={() =>
              onUpdateTextBox("box-discount", {
                fontSize: 72,
              })
            }
            style={{
              width: "100%",
              padding: "8px",
              backgroundColor: tokens.toolBtnBg,
              border: `1px solid ${tokens.toolBtnBorder}`,
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
              color: tokens.textActive,
              transition: "all 0.2s"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = tokens.accent;
              e.currentTarget.style.color = "#fff";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = tokens.toolBtnBg;
              e.currentTarget.style.color = tokens.textActive;
            }}
          >
            Set Discount Size to 72px
          </button>
        </div>
        
        {/* Keyboard Shortcuts Cheat Sheet */}
        <div
          style={{
            marginTop: "20px",
            fontSize: "11px",
            color: tokens.text,
            textAlign: "left"
          }}
        >
          <div style={{ fontWeight: "bold", color: tokens.textActive, marginBottom: "6px" }}>Keyboard Controls:</div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span>Arrow Keys</span>
            <span>Move 1px</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Shift + Arrows</span>
            <span>Move 10px</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
