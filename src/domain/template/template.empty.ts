import type { Template } from "./template.types";

/**
 * Create the canonical empty working document for a brand-new Master template.
 *
 * This is intentionally blank: no background image, no boxes, no variable
 * placeholders and no demo data. It only provides a valid logical canvas
 * (1200 × 1600) so the full editor chrome (layers, variable picker, properties
 * panel and canvas) can operate exactly as in Edit mode.
 *
 * The template has no persisted identity yet: `id` is a placeholder and the
 * protocol keeps signalling `template: null` over the wire until the first
 * successful save.
 */
export function createEmptyTemplate(now: Date = new Date()): Template {
  const timestamp = now.toISOString();

  return {
    id: "new-template",
    name: "New Template",
    code: "",
    campaign: "pay-eazy-standee",
    background: {
      imageUrl: null,
    },
    boxes: [],
    settings: {
      canvasWidth: 1200,
      canvasHeight: 1600,
      backgroundColor: "#FFFFFF",
      bleed: 0,
    },
    active: true,
    version: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}