import type { Template } from "../../domain/template/template.types";
import { LayersPanel } from "../layers/LayersPanel";
import type { DesignTokens } from "./EditorHeader";
import { VariablePicker } from "../variables/VariablePicker";
import { TemplateInformation } from "./TemplateInformation";

interface LeftSidebarProps {
  template: Template;
  selectedBoxId: string | null;
  tokens: DesignTokens;

  onSelectBox: (boxId: string | null) => void;

  onDeleteBox: (
    boxId: string
  ) => void;
}

export function LeftSidebar({
  template,
  selectedBoxId,
  tokens,
  onSelectBox,
  onDeleteBox,
}: LeftSidebarProps) {
  return (
    <aside
      style={{
        width: "260px",
        minWidth: "260px",
        flexShrink: 0,
        borderRight: `1px solid ${tokens.border}`,
        background: tokens.panelBg,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        boxSizing: "border-box",
        transition:
          "background-color 0.2s, border-color 0.2s",
      }}
    >
      {/* Layers Section */}

      <LayersPanel
        boxes={template.boxes}
        selectedBoxId={selectedBoxId}
        tokens={tokens}
        onSelectBox={onSelectBox}
        onDeleteBox={onDeleteBox}
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

      {/* Template Information */}
      <TemplateInformation template={template} tokens={tokens} />
    </aside>
  );
}
