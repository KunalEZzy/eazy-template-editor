import { Textbox,  Image as FabricImage, } from "fabric";
import type { TextBox } from "../domain/box/box.types";
import type { PreviewData } from "../domain/variables/preview.types";
import type { QRBox } from "../domain/box/box.types";
import { resolveTextVariable, resolveQRVariable, } from "../domain/variables/previewResolver";
import { generateQRPreview } from "../services/qr/qrPreviewService";

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

export async function qrBoxToFabric(
  box: QRBox,
  previewData: PreviewData,
  canvasSize: CanvasSize
): Promise<FabricImage> {
  const left = percentageToPixels(
    box.x,
    canvasSize.width
  );

  const top = percentageToPixels(
    box.y,
    canvasSize.height
  );

  const boxWidth = percentageToPixels(
    box.width,
    canvasSize.width
  );

  const boxHeight = percentageToPixels(
    box.height,
    canvasSize.height
  );

  const qrValue = resolveQRVariable(
    box.variable,
    previewData
  );

  const qrDataUrl =
    await generateQRPreview(
      qrValue,
      {
        width: Math.max(
          1,
          Math.round(boxWidth)
        ),
        foregroundColor:
          box.foregroundColor,
        backgroundColor:
          box.backgroundColor,
      }
    );

  const image =
    await FabricImage.fromURL(qrDataUrl);

  const imageWidth =
    image.width || 1;

  const imageHeight =
    image.height || 1;

  image.set({
    left,
    top,

    originX: "left",
    originY: "top",

    scaleX:
      boxWidth / imageWidth,

    scaleY:
      boxHeight / imageHeight,

    angle: box.rotation,

    opacity: box.opacity,

    selectable: !box.locked,

    evented: !box.locked,

    visible: box.visible,

    data: {
      boxId: box.id,
      baseWidth: imageWidth,
      baseHeight: imageHeight,
    },
  });

  image.setCoords();

  return image;
}