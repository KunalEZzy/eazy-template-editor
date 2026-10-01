import { describe, it, expect } from "vitest";
import {
  fitBackgroundToCanvas,
  canvasSizeForImage,
} from "../src/utils/backgroundFit";

describe("fitBackgroundToCanvas", () => {
  it("uses one scale factor for both axes so artwork is never stretched", () => {
    // The real bug: a 1:2 poster (5400x10800) in a 3:4 document (1200x1600).
    const fit = fitBackgroundToCanvas({
      imageWidth: 5400,
      imageHeight: 10800,
      canvasWidth: 1200,
      canvasHeight: 1600,
    });

    expect(fit).not.toBeNull();
    expect(fit!.scaleX).toBe(fit!.scaleY);
  });

  it("covers the document with a 1:2 image without distorting it", () => {
    const fit = fitBackgroundToCanvas({
      imageWidth: 5400,
      imageHeight: 10800,
      canvasWidth: 1200,
      canvasHeight: 1600,
    })!;

    // Cover scale is driven by the width: 1200/5400.
    expect(fit.scaleX).toBeCloseTo(1200 / 5400, 10);
    // Rendered height therefore exceeds the document and is clipped.
    expect(10800 * fit.scaleY).toBeCloseTo(2400, 6);
    expect(10800 * fit.scaleY).toBeGreaterThan(1600);
  });

  it("centres the overflow on both axes", () => {
    const fit = fitBackgroundToCanvas({
      imageWidth: 5400,
      imageHeight: 10800,
      canvasWidth: 1200,
      canvasHeight: 1600,
    })!;

    expect(fit.left).toBeCloseTo(0, 10);
    // 2400 rendered into 1600 => 400px trimmed from the top.
    expect(fit.top).toBeCloseTo(-400, 10);
  });

  it("preserves the aspect ratio of the rendered image", () => {
    const cases = [
      { imageWidth: 887, imageHeight: 1241, canvasWidth: 1200, canvasHeight: 1600 },
      { imageWidth: 1920, imageHeight: 1080, canvasWidth: 1200, canvasHeight: 1600 },
      { imageWidth: 1200, imageHeight: 1600, canvasWidth: 1200, canvasHeight: 1600 },
    ];

    for (const c of cases) {
      const fit = fitBackgroundToCanvas(c)!;
      const renderedRatio =
        (c.imageWidth * fit.scaleX) / (c.imageHeight * fit.scaleY);

      expect(renderedRatio).toBeCloseTo(c.imageWidth / c.imageHeight, 10);
    }
  });

  it("always covers the full document", () => {
    const fit = fitBackgroundToCanvas({
      imageWidth: 887,
      imageHeight: 1241,
      canvasWidth: 1200,
      canvasHeight: 1600,
    })!;

    expect(887 * fit.scaleX).toBeGreaterThanOrEqual(1200 - 1e-6);
    expect(1241 * fit.scaleY).toBeGreaterThanOrEqual(1600 - 1e-6);
  });

  it("is a no-op when the ratios already agree", () => {
    const fit = fitBackgroundToCanvas({
      imageWidth: 1200,
      imageHeight: 1600,
      canvasWidth: 1200,
      canvasHeight: 1600,
    })!;

    expect(fit.scaleX).toBe(1);
    expect(fit.scaleY).toBe(1);
    expect(fit.left).toBe(0);
    expect(fit.top).toBe(0);
  });

  it("returns null for invalid dimensions", () => {
    expect(
      fitBackgroundToCanvas({
        imageWidth: 0,
        imageHeight: 100,
        canvasWidth: 100,
        canvasHeight: 100,
      })
    ).toBeNull();

    expect(
      fitBackgroundToCanvas({
        imageWidth: 100,
        imageHeight: 100,
        canvasWidth: 0,
        canvasHeight: 100,
      })
    ).toBeNull();
  });
});

describe("canvasSizeForImage", () => {
  it("adopts the image aspect ratio", () => {
    const size = canvasSizeForImage({
      imageWidth: 5400,
      imageHeight: 10800,
      currentWidth: 1200,
      currentHeight: 1600,
      maxDimension: 4000,
    })!;

    expect(size.width / size.height).toBeCloseTo(0.5, 2);
  });

  it("preserves the document pixel area", () => {
    const size = canvasSizeForImage({
      imageWidth: 5400,
      imageHeight: 10800,
      currentWidth: 1200,
      currentHeight: 1600,
      maxDimension: 4000,
    })!;

    // Within 0.1% of the original area; the residue is whole-pixel rounding.
    expect(size.width * size.height).toBeGreaterThan(1200 * 1600 * 0.999);
    expect(size.width * size.height).toBeLessThan(1200 * 1600 * 1.001);
  });

  it("keeps a correctly proportioned document exactly as-is", () => {
    expect(
      canvasSizeForImage({
        imageWidth: 1200,
        imageHeight: 1600,
        currentWidth: 1200,
        currentHeight: 1600,
        maxDimension: 4000,
      })
    ).toEqual({ width: 1200, height: 1600, typographyScale: 1 });
  });

  it("reports a typography scale of exactly 1 so fonts cannot drift", () => {
    for (const dims of [
      [5400, 10800],
      [887, 1241],
      [1920, 1080],
      [1000, 3000],
    ]) {
      const size = canvasSizeForImage({
        imageWidth: dims[0],
        imageHeight: dims[1],
        currentWidth: 1200,
        currentHeight: 1600,
        maxDimension: 4000,
      })!;

      expect(size.typographyScale).toBeCloseTo(1, 10);
    }
  });

  it("declines pathological artwork rather than rescaling a saved design", () => {
    // A 1:18.5 image cannot honour its ratio inside the export budget, so the
    // resize is refused and the cover-fit crops instead. Crucially this leaves
    // font sizes alone.
    expect(
      canvasSizeForImage({
        imageWidth: 1080,
        imageHeight: 20000,
        currentWidth: 1200,
        currentHeight: 1600,
        maxDimension: 4000,
      })
    ).toBeNull();
  });

  it("still adopts ratios that stay inside the budget", () => {
    // 887x1241 (0.714) and 5400x10800 (0.5) are the real legacy shapes.
    for (const dims of [
      [887, 1241],
      [5400, 10800],
      [1920, 1080],
    ]) {
      const size = canvasSizeForImage({
        imageWidth: dims[0],
        imageHeight: dims[1],
        currentWidth: 1200,
        currentHeight: 1600,
        maxDimension: 4000,
      });

      expect(size).not.toBeNull();
      expect(Math.max(size!.width, size!.height)).toBeLessThanOrEqual(4000);
    }
  });

  it("returns whole pixels", () => {
    const size = canvasSizeForImage({
      imageWidth: 887,
      imageHeight: 1241,
      currentWidth: 1200,
      currentHeight: 1600,
      maxDimension: 4000,
    })!;

    expect(Number.isInteger(size.width)).toBe(true);
    expect(Number.isInteger(size.height)).toBe(true);
  });

  it("returns null for invalid input", () => {
    expect(
      canvasSizeForImage({
        imageWidth: 0,
        imageHeight: 100,
        currentWidth: 1200,
        currentHeight: 1600,
        maxDimension: 4000,
      })
    ).toBeNull();

    expect(
      canvasSizeForImage({
        imageWidth: 100,
        imageHeight: 100,
        currentWidth: 0,
        currentHeight: 1600,
        maxDimension: 4000,
      })
    ).toBeNull();
  });

  it("converges: recomputing from its own output is a fixed point", () => {
    const first = canvasSizeForImage({
      imageWidth: 5400,
      imageHeight: 10800,
      currentWidth: 1200,
      currentHeight: 1600,
      maxDimension: 4000,
    })!;

    const second = canvasSizeForImage({
      imageWidth: 5400,
      imageHeight: 10800,
      currentWidth: first.width,
      currentHeight: first.height,
      maxDimension: 4000,
    })!;

    expect(second.width).toBe(first.width);
    expect(second.height).toBe(first.height);
  });
});
