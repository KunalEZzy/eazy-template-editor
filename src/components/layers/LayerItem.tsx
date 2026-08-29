import type { Box } from "../../domain/box/box.types";

interface DesignTokens {
  text: string;
  textActive: string;
  accent: string;
  accentLight: string;
  accentText: string;
}

interface LayerItemProps {
  box: Box;
  isSelected: boolean;
  isDark: boolean;
  tokens: DesignTokens;
  onSelect: (boxId: string) => void;
}

export function LayerItem({ box, isSelected, isDark, tokens, onSelect }: LayerItemProps) {
  return (
    <button
      onClick={() => onSelect(box.id)}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 12px",
        textAlign: "left",
        background: isSelected ? tokens.accentLight : "transparent",
        border: isSelected ? `1px solid ${tokens.accent}` : "1px solid transparent",
        borderRadius: "6px",
        cursor: "pointer",
        color: isSelected ? tokens.accentText : tokens.text,
        fontWeight: isSelected ? 600 : 400,
        transition: "all 0.15s"
      }}
      onMouseOver={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = isDark ? "#222" : "#f3f4f6";
          e.currentTarget.style.color = tokens.textActive;
        }
      }}
      onMouseOut={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = tokens.text;
        }
      }}
    >
      {/* Layer Type Icon Tag */}
      <span
        style={{
          fontSize: "9px",
          fontWeight: "bold",
          padding: "2px 4px",
          background: box.type === "text" ? "#3b82f6" : "#10b981",
          color: "#fff",
          borderRadius: "3px",
          textTransform: "uppercase",
          lineHeight: 1
        }}
      >
        {box.type}
      </span>
      <span style={{ fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
        {box.id.replace("box-", "")}
      </span>

      {/* Locked Indicator */}
      {box.locked && (
        <span style={{ fontSize: "11px", color: tokens.text }}>🔒</span>
      )}
    </button>
  );
}
