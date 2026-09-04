import { Textbox, Image as FabricImage } from "fabric";
import type { TextBox, QRBox } from "../domain/box/box.types";
import type { PreviewData } from "../domain/variables/preview.types";
import { resolveTextVariable, resolveQRVariable } from "../domain/variables/previewResolver";
import { generateQRPreview } from "../services/qr/qrPreviewService";
import { calculateTextFit } from "./TextFit";

export interface CanvasSize {
  width: number;
  height: number;
}

export interface FabricCustomData {
  boxId?: string;
  isBackground?: boolean;
  baseWidth?: number;
  baseHeight?: number;
  foregroundColor?: string;
  backgroundColor?: string;
  variable?: string;
  logoUrl?: string;
}

export function percentageToPixels(
  percentage: number,
  totalPixels: number
): number {
  return (percentage / 100) * totalPixels;
}

export function pixelsToPercentage(
  pixels: number,
  totalPixels: number
): number {
  if (totalPixels <= 0) {
    return 0;
  }
  return (pixels / totalPixels) * 100;
}

function applyTextTransform(
  text: string,
  transform: TextBox["textTransform"]
): string {
  switch (transform) {
    case "uppercase":
      return text.toUpperCase();

    case "lowercase":
      return text.toLowerCase();

    case "capitalize":
      return text.replace(
        /\b\w/g,
        (character) => character.toUpperCase()
      );

    case "none":
    default:
      return text;
  }
}

export function textBoxToFabric(
  box: TextBox,
  previewData: PreviewData,
  canvasSize: CanvasSize
): Textbox {
  const left = percentageToPixels(box.x, canvasSize.width);
  const top = percentageToPixels(box.y, canvasSize.height);
  const boxWidth = percentageToPixels(box.width, canvasSize.width);
  const boxHeight = percentageToPixels(box.height, canvasSize.height);
  const resolvedTextValue = resolveTextVariable(box.variable, previewData);
  const textValue = applyTextTransform(resolvedTextValue, box.textTransform);

  const fitResult = calculateTextFit({
    text: textValue,

    width: boxWidth,
    height: boxHeight,

    fontFamily: box.fontFamily,
    fontWeight: box.fontWeight,

    fontSize: box.fontSize,
    lineHeight: box.lineHeight,

    letterSpacing: box.letterSpacing,
  });

  const customData: FabricCustomData = {
    boxId: box.id,
  };

  const text = new Textbox(textValue, {
    left,
    top,
    width: boxWidth,
    fontFamily: box.fontFamily,
    fontSize: fitResult.fontSize,
    fontWeight: box.fontWeight,
    fill: box.color,
    lineHeight: box.lineHeight,
    charSpacing: box.letterSpacing,
    angle: box.rotation,
    opacity: box.opacity,
    textAlign: box.textAlign,
    selectable: !box.locked,
    visible: box.visible,
    originX: "left",
    originY: "top",
    splitByGrapheme: false,
    data: customData,
  });

  text.set({
    width: boxWidth,
    scaleX: 1,
    scaleY: 1,
    left,
    top,
  });

  text.setCoords();
  return text;
}

export async function qrBoxToFabric(
  box: QRBox,
  previewData: PreviewData,
  canvasSize: CanvasSize
): Promise<FabricImage> {
  const left = percentageToPixels(box.x, canvasSize.width);
  const top = percentageToPixels(box.y, canvasSize.height);
  const boxWidth = percentageToPixels(box.width, canvasSize.width);
  const boxHeight = percentageToPixels(box.height, canvasSize.height);

  const qrValue = resolveQRVariable(box.variable, previewData);

  const qrDataUrl = await generateQRPreview(qrValue, {
    width: Math.max(1, Math.round(boxWidth)),
    foregroundColor: box.foregroundColor,
    backgroundColor: box.backgroundColor,
  });

  const image = await FabricImage.fromURL(qrDataUrl);
  const imageWidth = image.width || 1;
  const imageHeight = image.height || 1;

  const customData: FabricCustomData = {
    boxId: box.id,
    baseWidth: imageWidth,
    baseHeight: imageHeight,
    foregroundColor: box.foregroundColor,
    backgroundColor: box.backgroundColor,
    variable: box.variable,
    logoUrl: box.logoUrl,
  };

  image.set({
    left,
    top,
    originX: "left",
    originY: "top",
    scaleX: boxWidth / imageWidth,
    scaleY: boxHeight / imageHeight,
    angle: box.rotation,
    opacity: box.opacity,
    selectable: !box.locked,
    evented: !box.locked,
    visible: box.visible,
    data: customData,
  });

  image.setCoords();
  return image;
}