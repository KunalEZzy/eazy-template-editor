export interface CanvasDisplaySize {
  width: number;
  height: number;
  scale: number;
}

interface CalculateCanvasDisplaySizeParams {
  documentWidth: number;
  documentHeight: number;
  availableWidth: number;
  availableHeight: number;
}

export function calculateCanvasDisplaySize({
  documentWidth,
  documentHeight,
  availableWidth,
  availableHeight,
}: CalculateCanvasDisplaySizeParams): CanvasDisplaySize {
  // Guard against invalid dimensions
  if (
    documentWidth <= 0 ||
    documentHeight <= 0 ||
    availableWidth <= 0 ||
    availableHeight <= 0
  ) {
    return {
      width: 0,
      height: 0,
      scale: 0,
    };
  }

  const scaleX =
    availableWidth / documentWidth;

  const scaleY =
    availableHeight / documentHeight;

  // Use the smaller scale so the complete document
  // fits inside the available workspace.
  const scale = Math.min(
    scaleX,
    scaleY
  );

  return {
    width: documentWidth * scale,
    height: documentHeight * scale,
    scale,
  };
}