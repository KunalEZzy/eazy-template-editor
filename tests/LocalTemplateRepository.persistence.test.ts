import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalTemplateRepository } from "./LocalTemplateRepository";
import {
  InvalidTemplateDataError,
  TemplateNotFoundError,
} from "./TemplateRepository";
import type { Template } from "../domain/template/template.types";

const STORAGE_KEY = "eazy-template-editor:templates";
const storage = new Map<string, string>();

const localStorageShim = {
  getItem: (key: string): string | null =>
    storage.has(key) ? storage.get(key)! : null,
  setItem: (key: string, value: string): void => {
    storage.set(key, value);
  },
  removeItem: (key: string): void => {
    storage.delete(key);
  },
  clear: (): void => {
    storage.clear();
  },
  key: (index: number): string | null =>
    Array.from(storage.keys())[index] ?? null,
  get length(): number {
    return storage.size;
  },
} as Storage;

vi.stubGlobal("localStorage", localStorageShim);

function buildTemplate(overrides: Partial<Record<string, unknown>> = {}): Template {
  const template: Template = {
    id: "template-p0",
    name: "P0 Round Trip Template",
    code: "p0-round-trip",
    campaign: "pay-eazy-standee",
    background: {
      imageUrl: "https://example.com/background.png",
    },
    boxes: [
      {
        id: "box-text",
        type: "text",
        variable: "resNameNL",
        text: "Custom restaurant name",
        x: 12.5,
        y: 22.5,
        width: 55,
        height: 14,
        rotation: 12.5,
        opacity: 0.8,
        zIndex: 5,
        locked: true,
        visible: true,
        fontFamily: "Arial",
        fontSize: 48,
        fontWeight: 700,
        color: "#123456",
        color2: "#654321",
        textAlign: "center",
        textTransform: "uppercase",
        lineHeight: 1.4,
        letterSpacing: 2,
      },
      {
        id: "box-qr",
        type: "qr",
        variable: "resQR",
        x: 33.5,
        y: 66.5,
        width: 30,
        height: 30,
        rotation: -15,
        opacity: 0.9,
        zIndex: 6,
        locked: false,
        visible: true,
        foregroundColor: "#001122",
        backgroundColor: "#FFFFFF",
        logoUrl: "https://example.com/logo.png",
      },
      {
        id: "box-image",
        type: "image",
        imageUrl: "https://example.com/image.png",
        fit: "cover",
        x: 40,
        y: 50,
        width: 20,
        height: 20,
        rotation: 45,
        opacity: 1,
        zIndex: 7,
        locked: false,
        visible: false,
      },
    ],
    settings: {
      canvasWidth: 1200,
      canvasHeight: 1600,
      backgroundColor: "#FFFFFF",
      bleed: 8,
    },
    active: true,
    version: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  return JSON.parse(
    JSON.stringify({ ...template, ...overrides })
  ) as Template;
}

function updateInput(template: Template) {
  return {
    name: template.name,
    code: template.code,
    campaign: template.campaign,
    background: template.background,
    boxes: template.boxes,
    settings: template.settings,
    version: template.version,
  };
}

describe("LocalTemplateRepository persistence P0", () => {
  beforeEach(() => {
    storage.clear();
  });

  describe("full save → reload round trip", () => {
    it("persists every supported editable field and reloads it exactly", async () => {
      const seeded = buildTemplate();
      storage.set(STORAGE_KEY, JSON.stringify([seeded]));

      const repo = new LocalTemplateRepository();

      const saved = await repo.updateTemplate(
        seeded.id,
        updateInput(seeded)
      );
      const loaded = await repo.getTemplate(seeded.id);

      expect(saved.version).toBe(2);
      expect(loaded.version).toBe(2);

      expect(loaded.id).toBe(seeded.id);
      expect(loaded.name).toBe(seeded.name);
      expect(loaded.code).toBe(seeded.code);
      expect(loaded.campaign).toBe(seeded.campaign);
      expect(loaded.active).toBe(seeded.active);
      expect(loaded.createdAt).toBe(seeded.createdAt);

      expect(loaded.background).toEqual(seeded.background);
      expect(loaded.settings).toEqual(seeded.settings);
      expect(loaded.boxes).toEqual(seeded.boxes);

      const textBox = loaded.boxes.find((b) => b.type === "text");
      expect(textBox?.type).toBe("text");
      if (textBox && textBox.type === "text") {
        expect(textBox.rotation).toBe(12.5);
        expect(textBox.opacity).toBe(0.8);
        expect(textBox.zIndex).toBe(5);
        expect(textBox.locked).toBe(true);
        expect(textBox.visible).toBe(true);
        expect(textBox.color2).toBe("#654321");
        expect(textBox.text).toBe("Custom restaurant name");
        expect(textBox.variable).toBe("resNameNL");
      }

      const qrBox = loaded.boxes.find((b) => b.type === "qr");
      expect(qrBox?.type).toBe("qr");
      if (qrBox && qrBox.type === "qr") {
        expect(qrBox.logoUrl).toBe("https://example.com/logo.png");
        expect(qrBox.rotation).toBe(-15);
      }

      const imageBox = loaded.boxes.find((b) => b.type === "image");
      expect(imageBox?.type).toBe("image");
      if (imageBox && imageBox.type === "image") {
        expect(imageBox.imageUrl).toBe("https://example.com/image.png");
        expect(imageBox.fit).toBe("cover");
        expect(imageBox.visible).toBe(false);
      }
    });

    it("refreshes updatedAt while preserving createdAt", async () => {
      const seeded = buildTemplate();
      storage.set(STORAGE_KEY, JSON.stringify([seeded]));

      const repo = new LocalTemplateRepository();
      const saved = await repo.updateTemplate(
        seeded.id,
        updateInput(seeded)
      );

      expect(saved.updatedAt).not.toBe(seeded.updatedAt);
      expect(saved.createdAt).toBe(seeded.createdAt);
      expect(Number.isNaN(Date.parse(saved.updatedAt))).toBe(false);
    });
  });

  describe("versioning and optimistic concurrency", () => {
    it("increments version exactly once per successful save", async () => {
      const seeded = buildTemplate();
      storage.set(STORAGE_KEY, JSON.stringify([seeded]));

      const repo = new LocalTemplateRepository();

      const first = await repo.updateTemplate(
        seeded.id,
        updateInput(seeded)
      );
      expect(first.version).toBe(2);

      const reloadedAfterFirst = await repo.getTemplate(seeded.id);
      expect(reloadedAfterFirst.version).toBe(2);

      const second = await repo.updateTemplate(
        seeded.id,
        updateInput({ ...seeded, version: first.version })
      );
      expect(second.version).toBe(3);

      const reloadedAfterSecond = await repo.getTemplate(seeded.id);
      expect(reloadedAfterSecond.version).toBe(3);
    });

    it("rejects a stale version save and keeps the latest document", async () => {
      const seeded = buildTemplate({ version: 3 });
      storage.set(STORAGE_KEY, JSON.stringify([seeded]));

      const repo = new LocalTemplateRepository();

      const staleSave = buildTemplate({
        version: 2,
        name: "STALE SAVE SHOULD NOT WIN",
        boxes: [{ ...seeded.boxes[0], id: "box-stale", width: 1, height: 1 }],
      });

      await expect(
        repo.updateTemplate(seeded.id, updateInput(staleSave))
      ).rejects.toThrow(/modified by another session/);

      const loaded = await repo.getTemplate(seeded.id);
      expect(loaded.version).toBe(3);
      expect(loaded.name).toBe(seeded.name);
      expect(loaded.boxes).toEqual(seeded.boxes);
    });
  });

  describe("corrupt / empty storage", () => {
    it("empty array behaves as no template (current behavior)", async () => {
      storage.set(STORAGE_KEY, "[]");

      const repo = new LocalTemplateRepository();

      await expect(
        repo.getTemplate("template-001")
      ).rejects.toBeInstanceOf(TemplateNotFoundError);

      await expect(
        repo.updateTemplate("template-001", updateInput(buildTemplate()))
      ).rejects.toThrow(/not found/);
    });

    it("invalid JSON surfaces InvalidTemplateDataError on the save path", async () => {
      storage.set(STORAGE_KEY, "{not valid json");

      const repo = new LocalTemplateRepository();

      await expect(
        repo.updateTemplate("template-p0", updateInput(buildTemplate()))
      ).rejects.toBeInstanceOf(InvalidTemplateDataError);
    });

    it("duplicate box ids are rejected before any write", async () => {
      const duplicated = buildTemplate();
      (duplicated.boxes as unknown as Record<string, unknown>[])[1] = {
        ...(duplicated.boxes as unknown as Record<string, unknown>[])[0],
      };

      const seedString = JSON.stringify([duplicated]);
      storage.set(STORAGE_KEY, seedString);

      const repo = new LocalTemplateRepository();

      await expect(
        repo.updateTemplate("template-p0", updateInput(buildTemplate()))
      ).rejects.toBeInstanceOf(InvalidTemplateDataError);

      expect(storage.get(STORAGE_KEY)).toBe(seedString);
    });
  });
});