import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalTemplateRepository } from "../src/repository/LocalTemplateRepository";
import {
  readStoredTemplate,
  removeStoredTemplate,
} from "../src/repository/LocalTemplateRepository";
import {
  InvalidTemplateDataError,
  TemplateNotFoundError,
} from "../src/repository/TemplateRepository";
import type { Template } from "../src/domain/template/template.types";

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

  describe("versioning and save conflict handling", () => {
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

    it("accepts a save whose incoming version is behind the stored row", async () => {
      // Laravel always hands templates back with version 1, so the editor store
      // legitimately arrives at a save holding 1 while this row has climbed to 3.
      // That is not a concurrent editor and must never fail the save.
      const seeded = buildTemplate({ version: 3 });
      storage.set(STORAGE_KEY, JSON.stringify([seeded]));

      const repo = new LocalTemplateRepository();

      const outOfSyncSave = buildTemplate({
        version: 1,
        name: "Saved from a Laravel round trip",
        boxes: [{ ...seeded.boxes[0], id: "box-fresh", width: 42 }],
      });

      const saved = await repo.updateTemplate(
        seeded.id,
        updateInput(outOfSyncSave)
      );

      expect(saved.version).toBe(4);

      const loaded = await repo.getTemplate(seeded.id);
      expect(loaded.version).toBe(4);
      expect(loaded.name).toBe("Saved from a Laravel round trip");
      expect(loaded.boxes).toEqual(outOfSyncSave.boxes);
      expect(loaded.createdAt).toBe(seeded.createdAt);
    });
  });

  describe("corrupt / empty storage", () => {
    it("empty array still counts as not found for loads", async () => {
      storage.set(STORAGE_KEY, "[]");

      const repo = new LocalTemplateRepository();

      await expect(
        repo.getTemplate("template-001")
      ).rejects.toBeInstanceOf(TemplateNotFoundError);
    });

    it("saves a template handed in by an external source (e.g. Master) even when it was never stored", async () => {
      storage.set(STORAGE_KEY, "[]");

      const repo = new LocalTemplateRepository();

      const saved = await repo.updateTemplate(
        "104",
        updateInput(buildTemplate())
      );

      expect(saved.id).toBe("104");
      expect(saved.version).toBe(1);

      const loaded = await repo.getTemplate("104");
      expect(loaded.id).toBe("104");
      expect(loaded.name).toBe("P0 Round Trip Template");
      expect(loaded.background).toEqual(buildTemplate().background);
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

  describe("synchronous copy helpers", () => {
    it("reads a saved template back by id", () => {
      storage.set(
        STORAGE_KEY,
        JSON.stringify([{ ...buildTemplate(), id: "104" }])
      );

      expect(readStoredTemplate("104")?.id).toBe("104");
      expect(readStoredTemplate("missing")).toBeNull();
    });

    it("returns null instead of throwing on unusable storage", () => {
      expect(readStoredTemplate("template-p0")).toBeNull();

      storage.set(STORAGE_KEY, "{not valid json");
      expect(readStoredTemplate("template-p0")).toBeNull();

      storage.set(STORAGE_KEY, JSON.stringify({ not: "an array" }));
      expect(readStoredTemplate("template-p0")).toBeNull();

      storage.set(STORAGE_KEY, JSON.stringify([{ id: "template-p0" }]));
      expect(readStoredTemplate("template-p0")).toBeNull();
    });

    it("removes only the requested template", () => {
      storage.set(
        STORAGE_KEY,
        JSON.stringify([
          buildTemplate(),
          { ...buildTemplate(), id: "other" },
        ])
      );

      removeStoredTemplate("template-p0");

      const stored = JSON.parse(storage.get(STORAGE_KEY)!);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("other");
    });

    it("leaves unusable storage untouched", () => {
      storage.set(STORAGE_KEY, "{not valid json");

      removeStoredTemplate("template-p0");

      expect(storage.get(STORAGE_KEY)).toBe("{not valid json");
    });
  });
});