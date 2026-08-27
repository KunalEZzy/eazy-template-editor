import { Textbox } from "fabric";

import type { TextBox } from "../domain/box/box.types";
import type { PreviewData } from "../domain/variables/preview.types";
import { resolveTextVariable } from "../domain/variables/previewResolver";

export interface CanvasSize {
  width: number;
  height: number;
}

export function percentageToPixels(
  percentage: number,
  totalPixels: number
): number {
  return (
    (percentage / 100) *
    totalPixels
  );
}

export function pixelsToPercentage(
  pixels: number,
  totalPixels: number
): number {
  return (
    (pixels / totalPixels) *
    100
  );
}

export function textBoxToFabric(
  box: TextBox,
  previewData: PreviewData,
  canvasSize: CanvasSize
): Textbox {
  const left =
    percentageToPixels(
      box.x,
      canvasSize.width
    );

  const top =
    percentageToPixels(
      box.y,
      canvasSize.height
    );

  const boxWidth =
    percentageToPixels(
      box.width,
      canvasSize.width
    );

  const textValue =
    resolveTextVariable(
      box.variable,
      previewData
    );

  const text =
    new Textbox(
      textValue,
      {
        left,
        top,

        width: boxWidth,

        fontFamily:
          box.fontFamily,

        fontSize:
          box.fontSize,

        fontWeight:
          box.fontWeight,

        fill:
          box.color,

        angle:
          box.rotation,

        opacity:
          box.opacity,

        textAlign:
          box.textAlign,

        selectable:
          !box.locked,

        visible:
          box.visible,

        originX: "left",
        originY: "top",

        splitByGrapheme:
          false,
      }
    );

  /*
   * Domain width is the source
   * of truth.
   */
  text.set({
    width: boxWidth,
    scaleX: 1,
    scaleY: 1,

    left,
    top,
  });

  text.setCoords();

  text.set({
    data: {
      boxId: box.id,
    },
  });

  return text;
}