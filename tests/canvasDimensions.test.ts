import { describe, it, expect } from "vitest";
import { calculateCanvasDisplaySize } from "../src/utils/canvasDimensions";

describe("calculateCanvasDisplaySize", () => {
  it("should calculate correct scale and display dimensions when height is the limiting dimension", () => {
    const result = calculateCanvasDisplaySize({
      documentWidth: 1200,
      documentHeight: 1600,
      availableWidth: 1000,
      availableHeight: 800,
    });

    expect(result.scale).toBe(0.5);
    expect(result.width).toBe(600);
    expect(result.height).toBe(800);
  });

  it("should calculate correct scale and display dimensions when width is the limiting dimension", () => {
    const result = calculateCanvasDisplaySize({
      documentWidth: 1200,
      documentHeight: 1600,
      availableWidth: 300,
      availableHeight: 800,
    });

    expect(result.scale).toBe(0.25);
    expect(result.width).toBe(300);
    expect(result.height).toBe(400);
  });

  it("should handle invalid/zero dimensions gracefully without crashing", () => {
    const zeroResult = calculateCanvasDisplaySize({
      documentWidth: 0,
      documentHeight: 1600,
      availableWidth: 500,
      availableHeight: 500,
    });

    expect(zeroResult).toEqual({ width: 0, height: 0, scale: 0 });

    const negResult = calculateCanvasDisplaySize({
      documentWidth: 1200,
      documentHeight: 1600,
      availableWidth: -10,
      availableHeight: 500,
    });

    expect(negResult).toEqual({ width: 0, height: 0, scale: 0 });
  });

  it("should preserve exact aspect ratio", () => {
    const docW = 1200;
    const docH = 1600;
    const result = calculateCanvasDisplaySize({
      documentWidth: docW,
      documentHeight: docH,
      availableWidth: 733,
      availableHeight: 911,
    });

    const docAspect = docW / docH;
    const displayAspect = result.width / result.height;
    expect(displayAspect).toBeCloseTo(docAspect, 5);
  });

  it("maps any available display size to a scale while the logical document dimensions stay fixed at 1200x1600", () => {
    const logicalWidth = 1200;
    const logicalHeight = 1600;

    const availableSizes = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 400, height: 1600 },
      { width: 300, height: 500 },
      { width: 900, height: 700 },
    ];

    for (const available of availableSizes) {
      const result = calculateCanvasDisplaySize({
        documentWidth: logicalWidth,
        documentHeight: logicalHeight,
        availableWidth: available.width,
        availableHeight: available.height,
      });

      const reconstructedWidth = result.width / result.scale;
      const reconstructedHeight = result.height / result.scale;

      expect(reconstructedWidth).toBeCloseTo(logicalWidth, 5);
      expect(reconstructedHeight).toBeCloseTo(logicalHeight, 5);

      expect(result.width).toBeLessThanOrEqual(available.width);
      expect(result.height).toBeLessThanOrEqual(available.height);
    }
  });

  it("allows upscaling beyond logical size when the display area is larger than the document", () => {
    const result = calculateCanvasDisplaySize({
      documentWidth: 1200,
      documentHeight: 1600,
      availableWidth: 2400,
      availableHeight: 3200,
    });

    expect(result.scale).toBe(2);
    expect(result.width).toBe(2400);
    expect(result.height).toBe(3200);

    const resultWidthLimited = calculateCanvasDisplaySize({
      documentWidth: 1200,
      documentHeight: 1600,
      availableWidth: 1800,
      availableHeight: 4000,
    });

    expect(resultWidthLimited.scale).toBe(1.5);
    expect(resultWidthLimited.width).toBe(1800);
    expect(resultWidthLimited.height).toBe(2400);
  });
});

