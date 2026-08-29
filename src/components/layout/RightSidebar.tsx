import { PropertiesPanel } from "../properties/PropertiesPanel";
import type { DesignTokens } from "./EditorHeader";

interface RightSidebarProps {
  tokens: DesignTokens;
}

export function RightSidebar({ tokens }: RightSidebarProps) {
  return (
    <aside
      style={{
        background: tokens.panelBg,
        borderLeft: `1px solid ${tokens.border}`,
        height: "100%",
        overflowY: "auto",
        transition: "background-color 0.2s, border-color 0.2s"
      }}
    >
      {/* Inject styling overrides to customize the properties panel to match the light/dark design token variables */}
      <style>{`
        /* properties sidebar overrides */
        aside h2, aside h3 {
          color: ${tokens.textActive} !important;
          transition: color 0.2s;
        }
        aside div {
          color: ${tokens.text} !important;
          border-color: ${tokens.border} !important;
          background-color: ${tokens.panelBg} !important;
          transition: all 0.2s;
        }
        aside strong {
          color: ${tokens.textActive} !important;
          transition: color 0.2s;
        }
        aside hr {
          border-color: ${tokens.border} !important;
          transition: border-color 0.2s;
        }
      `}</style>
      <PropertiesPanel />
    </aside>
  );
}
