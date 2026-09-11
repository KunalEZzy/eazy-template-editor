import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalTemplateRepository } from "./LocalTemplateRepository";
import {
  InvalidTemplateDataError,
  TemplateNotFoundError,
} from "./TemplateRepository";
import { mockTemplate } from "../domain/template/template.mock";

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

function validStoredTemplate(overrides: Record<string, unknown> = {}) {
  return { ...JSON.parse(JSON.stringify(mockTemplate)), ...overrides };
}

describe("LocalTemplateRepository read boundary", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("returns the mocked fallback when nothing is stored", async () => {
    const repo = new LocalTemplateRepository();
    const template = await repo.getTemplate("template-001");
    expect(template.id).toBe("template-001");
    expect(template.version).toBe(1);
  });

  it("surfaces a controlled error for invalid JSON", async () => {
    storage.set(STORAGE_KEY, "{not valid json");
    const repo = new LocalTemplateRepository();
    await expect(repo.getTemplate("template-001")).rejects.toBeInstanceOf(
      InvalidTemplateDataError
    );
  });

  it("surfaces a controlled error for a non-array persisted collection", async () => {
    storage.set(STORAGE_KEY, JSON.stringify({ id: "template-001" }));
    const repo = new LocalTemplateRepository();
    await expect(repo.getTemplate("template-001")).rejects.toBeInstanceOf(
      InvalidTemplateDataError
    );
  });

  it("surfaces a controlled error for invalid members", async () => {
    storage.set(STORAGE_KEY, JSON.stringify([{ id: "template-001" }]));
    const repo = new LocalTemplateRepository();
    await expect(repo.getTemplate("template-001")).rejects.toBeInstanceOf(
      InvalidTemplateDataError
    );
  });

  it("does not silently fall back to mockTemplate for corrupted data", async () => {
    storage.set(STORAGE_KEY, "not json at all");
    const repo = new LocalTemplateRepository();
    await expect(repo.getTemplate("template-001")).rejects.toBeInstanceOf(
      InvalidTemplateDataError
    );
  });

  it("returns valid persisted templates normally", async () => {
    storage.set(
      STORAGE_KEY,
      JSON.stringify([validStoredTemplate({ version: 5 })])
    );
    const repo = new LocalTemplateRepository();
    const template = await repo.getTemplate("template-001");
    expect(template.version).toBe(5);
  });

  it("still treats a missing id as not found", async () => {
    storage.set(STORAGE_KEY, JSON.stringify([validStoredTemplate()]));
    const repo = new LocalTemplateRepository();
    await expect(repo.getTemplate("other-id")).rejects.toBeInstanceOf(
      TemplateNotFoundError
    );
  });

  it("save semantics and version increment remain unchanged", async () => {
    const repo = new LocalTemplateRepository();
    const saved = await repo.updateTemplate("template-001", {
      name: mockTemplate.name,
      code: mockTemplate.code,
      campaign: mockTemplate.campaign,
      background: mockTemplate.background,
      boxes: mockTemplate.boxes,
      settings: mockTemplate.settings,
      version: 1,
    });

    expect(saved.version).toBe(2);
  });
});