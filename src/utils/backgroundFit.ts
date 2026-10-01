export interface BackgroundFit {
  scaleX: number;
  scaleY: number;
  left: number;
  top: number;
}

interface FitBackgroundParams {
  imageWidth: number;
  imageHeight: number;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Fit a background image over the whole document without ever distorting it.
 *
 * The previous implementation scaled the axes independently:
 *
 *   scaleX = canvasWidth / imageWidth
 *   scaleY = canvasHeight / imageHeight
 *
 * which stretches the image whenever its aspect ratio differs from the
 * document's. Real poster art is frequently 1:2 (5400x10800) while the document
 * is 3:4 (1200x1600), so those two factors differ by ~1.5x and the artwork
 * comes out visibly squashed.
 *
 * A "cover" fit uses a single scale factor for both axes, so the artwork keeps
 * its true proportions; anything that does not fit is centred and clipped by
 * the document bounds.
 */
export function fitBackgroundToCanvas({
  imageWidth,
  imageHeight,
  canvasWidth,
  canvasHeight,
}: FitBackgroundParams): BackgroundFit | null {
  if (
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    canvasWidth <= 0 ||
    canvasHeight <= 0
  ) {
    return null;
  }

  const scale = Math.max(canvasWidth / imageWidth, canvasHeight / imageHeight);

  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;

  return {
    scaleX: scale,
    scaleY: scale,
    left: (canvasWidth - renderedWidth) / 2,
    top: (canvasHeight - renderedHeight) / 2,
  };
}

interface CanvasSizeForImageParams {
  imageWidth: number;
  imageHeight: number;
  currentWidth: number;
  currentHeight: number;
  maxDimension: number;
}

export interface CanvasSizeMatch {
  width: number;
  height: number;
  /**
   * Factor to apply to absolute pixel values (font sizes, bleed) so they keep
   * their visual weight. Derived from the document resize; see the note in
   * `canvasSizeForImage` for why this evaluates to 1 in the current model.
   */
  typographyScale: number;
}

/**
 * Document size that matches an image's real aspect ratio.
 *
 * The document's pixel *area* is preserved while its aspect ratio follows the
 * artwork. That matters for two reasons:
 *
 * 1. Box geometry is stored as percentages of the document, so boxes stay in
 *    proportion. `fontSize` and `bleed` are absolute pixels, so preserving area
 *    keeps them visually correct without touching a single box.
 *
 * 2. Resizing purely on one axis (pin the width, derive the height) would make
 *    the resize non-uniform, and no single font factor can then be correct: the
 *    factor needed to preserve the layout differs per axis. Scaling fonts by
 *    the height ratio alone would enlarge text by up to 1.5x on tall artwork
 *    and overflow the (unchanged) box widths. Worse, because the document size
 *    is not persisted, that scale would be recomputed and re-applied on every
 *    load, compounding with each Submit.
 *
 * Because the area is held constant, the geometric mean of the two axis
 * factors is exactly 1, so `typographyScale` is 1 and no data can drift.
 */
export function canvasSizeForImage({
  imageWidth,
  imageHeight,
  currentWidth,
  currentHeight,
  maxDimension,
}: CanvasSizeForImageParams): CanvasSizeMatch | null {
  if (
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    currentWidth <= 0 ||
    currentHeight <= 0
  ) {
    return null;
  }

  const ratio = imageWidth / imageHeight;
  const area = currentWidth * currentHeight;

  // w * h = area and w / h = ratio  =>  w = sqrt(area * ratio)
  const width = Math.max(1, Math.round(Math.sqrt(area * ratio)));
  const height = Math.max(1, Math.round(area / width));

  // If honouring the artwork's ratio would breach the export budget, the
  // document can no longer preserve its area, and any typography scale would
  // start mutating a saved design. Such artwork is pathological (a ratio
  // outside roughly 0.12-8.33 for a 3:4 document); decline the resize and let
  // the cover-fit crop instead, so fonts are never rescaled behind the user's
  // back.
  if (maxDimension > 0 && Math.max(width, height) > maxDimension) {
    return null;
  }

  const axisX = width / currentWidth;
  const axisY = height / currentHeight;

  // Rounding the two axes to whole pixels leaves a sub-0.01% residue, which
  // would otherwise shrink every font by a hair on each load. Snapping it to 1
  // keeps the "typography cannot drift" property exactly true.
  const rawScale = Math.sqrt(axisX * axisY);
  const typographyScale = Math.abs(rawScale - 1) < 0.001 ? 1 : rawScale;

  return {
    width,
    height,
    // Area-preserving resizes evaluate to exactly 1; computed rather than
    // hard-coded so the value stays meaningful if the sizing model changes.
    typographyScale,
  };
}
