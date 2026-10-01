import { describe, it, expect } from "vitest";
import {
  percentageToPixels,
  pixelsToPercentage,
  textBoxToFabric,
} from "../src/canvas/CanvasAdapter";
import { mockTemplate } from "../src/domain/template/template.mock";
import { mockPreviewData } from "../src/domain/variables/preview.mock";

describe("CanvasAdapter coordinate conversion", () => {
  const documentWidth = 1200;
  const documentHeight = 1600;

  it("converts percentage to document pixels correctly", () => {
    expect(percentageToPixels(50, documentWidth)).toBe(600);
    expect(percentageToPixels(25, documentHeight)).toBe(400);
    expect(percentageToPixels(0, documentWidth)).toBe(0);
    expect(percentageToPixels(100, documentHeight)).toBe(1600);
  });

  it("converts document pixels to percentage correctly", () => {
    expect(pixelsToPercentage(600, documentWidth)).toBe(50);
    expect(pixelsToPercentage(400, documentHeight)).toBe(25);
    expect(pixelsToPercentage(0, documentWidth)).toBe(0);
    expect(pixelsToPercentage(1600, documentHeight)).toBe(100);
  });

  it("is reversible between percentage and pixels", () => {
    const originalPercentage = 37.5;
    const pixels = percentageToPixels(originalPercentage, documentWidth);
    const convertedBack = pixelsToPercentage(pixels, documentWidth);
    expect(convertedBack).toBeCloseTo(originalPercentage, 5);
  });
});

describe("CanvasAdapter selection styling", () => {
  it("uses high-contrast dark selection border and solid corners on the light canvas", () => {
    const textBox = mockTemplate.boxes.find((box) => box.type === "text");
    expect(textBox).toBeDefined();
    expect(textBox && textBox.type).toBe("text");

    const canvas = textBoxToFabric(textBox!, mockPreviewData, {
      width: 1200,
      height: 1600,
    });

    expect(canvas.borderColor).toBe("#1f2937");
    expect(canvas.cornerColor).toBe("#1f2937");
    expect(canvas.cornerStrokeColor).toBe("#1f2937");
    expect(canvas.transparentCorners).toBe(false);
  });
});

