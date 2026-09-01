import type { Box } from "../../domain/box/box.types";
import { LayerItem } from "./LayerItem";

interface DesignTokens {
  text: string;
  textActive: string;
  accent: string;
  accentLight: string;
  accentText: string;
  border: string;
}

interface LayersPanelProps {
  boxes: Box[];
  selectedBoxId: string | null;
  isDark: boolean;
  tokens: DesignTokens;

  onSelectBox: (boxId: string) => void;

  onDeleteBox: (boxId: string) => void;
}

export function LayersPanel({
  boxes,
  selectedBoxId,
  isDark,
  tokens,
  onSelectBox,
  onDeleteBox,
}: LayersPanelProps) {
  return (
    <div
      style={{
        padding: "16px",
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <h2
          style={{
            fontSize: "11px",
            fontWeight: 700,
            textTransform: "uppercase",
            color: tokens.text,
            margin: 0,
            letterSpacing: "0.5px",
          }}
        >
          Layers ({boxes.length})
        </h2>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {boxes.map((box) => (
          <LayerItem
            key={box.id}
            box={box}
            isSelected={
              selectedBoxId === box.id
            }
            isDark={isDark}
            tokens={tokens}
            onSelect={onSelectBox}
            onDelete={onDeleteBox}
          />
        ))}
      </div>
    </div>
  );
}