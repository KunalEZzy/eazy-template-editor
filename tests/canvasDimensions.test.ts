import { describe, it, expect } from "vitest";
import { calculateCanvasDisplaySize } from "./canvasDimensions";

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
});

