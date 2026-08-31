import type { Box } from "../../domain/box/box.types";

export interface BoxPlacement {
  x: number;
  y: number;
}

const POSITION_STEP = 5;
const MAX_ATTEMPTS = 20;

function boxesOverlap(
  x: number,
  y: number,
  width: number,
  height: number,
  box: Box
): boolean {
  return (
    x < box.x + box.width &&
    x + width > box.x &&
    y < box.y + box.height &&
    y + height > box.y
  );
}

export function findAvailableBoxPlacement(
  boxes: Box[],
  defaultPlacement: BoxPlacement,
  width: number,
  height: number
): BoxPlacement {
  let x = defaultPlacement.x;
  let y = defaultPlacement.y;

  for (
    let attempt = 0;
    attempt < MAX_ATTEMPTS;
    attempt++
  ) {
    const overlapsExistingBox =
      boxes.some((box) =>
        boxesOverlap(
          x,
          y,
          width,
          height,
          box
        )
      );

    if (!overlapsExistingBox) {
      return {
        x,
        y,
      };
    }

    x += POSITION_STEP;

    if (x + width > 100) {
      x = defaultPlacement.x;
      y += POSITION_STEP;
    }

    if (y + height > 100) {
      return defaultPlacement;
    }
  }

  return defaultPlacement;
}