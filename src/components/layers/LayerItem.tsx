import type { Box } from "../../domain/box/box.types";

interface DesignTokens {
  text: string;
  textActive: string;
  accent: string;
  accentLight: string;
  accentText: string;
  border?: string;
}

interface LayerItemProps {
  box: Box;
  isSelected: boolean;
  isDark: boolean;
  tokens: DesignTokens;
  onSelect: (boxId: string) => void;
  onDelete: (boxId: string) => void;
}

export function LayerItem({
  box,
  isSelected,
  isDark,
  tokens,
  onSelect,
  onDelete,
}: LayerItemProps) {
  return (
    <div
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        boxSizing: "border-box",
        background: isSelected
          ? tokens.accentLight
          : "transparent",
        border: isSelected
          ? `1px solid ${tokens.accent}`
          : "1px solid transparent",
        borderRadius: "6px",
        transition: "all 0.15s",
      }}
      onMouseOver={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background =
            isDark ? "#222" : "#f3f4f6";
        }
      }}
      onMouseOut={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background =
            "transparent";
        }
      }}
    >
      {/* Layer Selection Area */}
      <button
        type="button"
        onClick={() => onSelect(box.id)}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 8px 8px 12px",
          textAlign: "left",
          background: "transparent",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          color: isSelected
            ? tokens.accentText
            : tokens.text,
          fontWeight: isSelected ? 600 : 400,
        }}
      >
        {/* Layer Type */}
        <span
          style={{
            flexShrink: 0,
            fontSize: "9px",
            fontWeight: "bold",
            padding: "2px 4px",
            background:
              box.type === "text"
                ? "#3b82f6"
                : "#10b981",
            color: "#fff",
            borderRadius: "3px",
            textTransform: "uppercase",
            lineHeight: 1,
          }}
        >
          {box.type}
        </span>

        {/* Layer Name */}
        <span
          style={{
            fontSize: "13px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {box.id.replace("box-", "")}
        </span>

        {/* Locked Indicator */}
        {box.locked && (
          <span
            style={{
              flexShrink: 0,
              fontSize: "11px",
              color: tokens.text,
            }}
          >
            🔒
          </span>
        )}
      </button>

      {/* Delete */}
      <button
        type="button"
        aria-label={`Delete ${box.id}`}
        title="Delete"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(box.id);
        }}
        style={{
          flexShrink: 0,
          width: "30px",
          height: "30px",
          marginRight: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          background: "transparent",
          border: "none",
          borderRadius: "5px",
          color: tokens.text,
          cursor: "pointer",
          fontSize: "13px",
        }}
        onMouseOver={(event) => {
          event.currentTarget.style.background =
            isDark ? "#3a1f1f" : "#fee2e2";

          event.currentTarget.style.color =
            "#ef4444";
        }}
        onMouseOut={(event) => {
          event.currentTarget.style.background =
            "transparent";

          event.currentTarget.style.color =
            tokens.text;
        }}
      >
        🗑️
      </button>
    </div>
  );
}