import type { Box } from "../../domain/box/box.types";
import { PropertyInput } from "./PropertyInput";

interface GeometrySectionProps {
  box: Box;
  updateBoxTransform: (
    boxId: string,
    changes: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
    }
  ) => void;
}

export function GeometrySection({ box, updateBoxTransform }: GeometrySectionProps) {
  return (
    <div>
      <h3 style={{ fontSize: "11px", fontWeight: 700, margin: "0 0 8px", color: "var(--text-h)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
        Geometry
      </h3>
      
      {/* Row 1: X & Y Position */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <div style={{ flex: 1 }}>
          <PropertyInput
            label="X"
            value={box.x}
            step="0.1"
            onChange={(val) => updateBoxTransform(box.id, { x: val })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <PropertyInput
            label="Y"
            value={box.y}
            step="0.1"
            onChange={(val) => updateBoxTransform(box.id, { y: val })}
          />
        </div>
      </div>

      {/* Row 2: Width */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
        <div style={{ flex: 1 }}>
          <PropertyInput
            label="W"
            value={box.width}
            step="0.1"
            onChange={(val) => updateBoxTransform(box.id, { width: val })}
          />
        </div>
      </div>

      {/* Row 3: Rotation */}
      <div style={{ display: "flex", gap: "8px" }}>
        <div style={{ flex: 1 }}>
          <PropertyInput
            label="R"
            value={box.rotation}
            step="1"
            onChange={(val) => updateBoxTransform(box.id, { rotation: val })}
          />
        </div>
      </div>
    </div>
  );
}
