import { PropertiesPanel } from "../properties/PropertiesPanel";
import type { DesignTokens } from "./EditorHeader";

interface RightSidebarProps {
  tokens: DesignTokens;
}

const SIDEBAR_WIDTH = 330;

export function RightSidebar({ tokens }: RightSidebarProps) {
  return (
    <aside
      style={{
        width: `${SIDEBAR_WIDTH}px`,
        minWidth: `${SIDEBAR_WIDTH}px`,
        flexShrink: 0,
        background: tokens.panelBg,
        borderLeft: `1px solid ${tokens.border}`,
        height: "100%",
        overflowY: "auto",
        boxSizing: "border-box",
        transition: "background-color 0.2s, border-color 0.2s",
      }}
    >
      <PropertiesPanel />
    </aside>
  );
}