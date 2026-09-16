import type { Template } from "./template.types";
import type { Box } from "../box/box.types";

const CAMPAIGN_TYPES: readonly string[] = [
  "pay-eazy-tent-card",
  "pay-eazy-standee",
  "eatout",
  "foodie-awards",
];

const TEXT_ALIGNMENTS: readonly string[] = [
  "left",
  "center",
  "right",
];

const TEXT_TRANSFORMS: readonly string[] = [
  "none",
  "capitalize",
  "uppercase",
  "lowercase",
];

const IMAGE_FITS: readonly string[] = [
  "contain",
  "cover",
  "fill",
];

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBox(value: unknown): value is Box {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.id !== "string") {
    return false;
  }

  if (
    value.type !== "text" &&
    value.type !== "qr" &&
    value.type !== "image"
  ) {
    return false;
  }

  if (!isFiniteNumber(value.x) || !isFiniteNumber(value.y)) {
    return false;
  }

  if (!isFiniteNumber(value.width) || value.width <= 0) {
    return false;
  }

  if (!isFiniteNumber(value.height) || value.height <= 0) {
    return false;
  }

  if (!isFiniteNumber(value.zIndex)) {
    return false;
  }

  if (value.rotation !== undefined && !isFiniteNumber(value.rotation)) {
    return false;
  }

  if (value.opacity !== undefined && !isFiniteNumber(value.opacity)) {
    return false;
  }

  if (value.locked !== undefined && typeof value.locked !== "boolean") {
    return false;
  }

  if (value.visible !== undefined && typeof value.visible !== "boolean") {
    return false;
  }

  if (value.type === "text") {
    if (typeof value.variable !== "string") {
      return false;
    }

    if (value.text !== undefined && typeof value.text !== "string") {
      return false;
    }

    if (typeof value.fontFamily !== "string") {
      return false;
    }

    if (!isFiniteNumber(value.fontSize)) {
      return false;
    }

    if (!isFiniteNumber(value.fontWeight)) {
      return false;
    }

    if (typeof value.color !== "string") {
      return false;
    }

    if (value.color2 !== undefined && typeof value.color2 !== "string") {
      return false;
    }

    if (
      typeof value.textAlign !== "string" ||
      !TEXT_ALIGNMENTS.includes(value.textAlign)
    ) {
      return false;
    }

    if (
      typeof value.textTransform !== "string" ||
      !TEXT_TRANSFORMS.includes(value.textTransform)
    ) {
      return false;
    }

    if (!isFiniteNumber(value.lineHeight)) {
      return false;
    }

    if (!isFiniteNumber(value.letterSpacing)) {
      return false;
    }

    return true;
  }

  if (value.type === "qr") {
    if (typeof value.variable !== "string") {
      return false;
    }

    if (typeof value.foregroundColor !== "string") {
      return false;
    }

    if (typeof value.backgroundColor !== "string") {
      return false;
    }

    if (value.logoUrl !== undefined && typeof value.logoUrl !== "string") {
      return false;
    }

    return true;
  }

  if (typeof value.imageUrl !== "string") {
    return false;
  }

  return (
    typeof value.fit === "string" &&
    IMAGE_FITS.includes(value.fit)
  );
}

export function isTemplate(value: unknown): value is Template {
  if (!isRecord(value)) {
    return false;
  }

  if (typeof value.id !== "string") {
    return false;
  }

  if (typeof value.name !== "string") {
    return false;
  }

  if (typeof value.code !== "string") {
    return false;
  }

  if (
    typeof value.campaign !== "string" ||
    !CAMPAIGN_TYPES.includes(value.campaign)
  ) {
    return false;
  }

  if (!isRecord(value.background)) {
    return false;
  }

  if (
    value.background.imageUrl !== null &&
    typeof value.background.imageUrl !== "string"
  ) {
    return false;
  }

  if (!isRecord(value.settings)) {
    return false;
  }

  if (
    !isFiniteNumber(value.settings.canvasWidth) ||
    value.settings.canvasWidth <= 0
  ) {
    return false;
  }

  if (
    !isFiniteNumber(value.settings.canvasHeight) ||
    value.settings.canvasHeight <= 0
  ) {
    return false;
  }

  if (
    value.settings.backgroundColor !== undefined &&
    typeof value.settings.backgroundColor !== "string"
  ) {
    return false;
  }

  if (
    value.settings.bleed !== undefined &&
    !isFiniteNumber(value.settings.bleed)
  ) {
    return false;
  }

  if (!Array.isArray(value.boxes)) {
    return false;
  }

  const ids = new Set<string>();

  for (const box of value.boxes) {
    if (!isBox(box)) {
      return false;
    }

    if (ids.has(box.id)) {
      return false;
    }

    ids.add(box.id);
  }

  if (!isFiniteNumber(value.version)) {
    return false;
  }

  if (value.active !== undefined && typeof value.active !== "boolean") {
    return false;
  }

  if (value.createdAt !== undefined && typeof value.createdAt !== "string") {
    return false;
  }

  if (value.updatedAt !== undefined && typeof value.updatedAt !== "string") {
    return false;
  }

  return true;
}