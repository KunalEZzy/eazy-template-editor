import type { Template } from "../domain/template/template.types";

import {
  InvalidTemplateDataError,
  TemplateNotFoundError,
  type CreateTemplateInput,
  type TemplateRepository,
  type UpdateTemplateInput,
} from "./TemplateRepository";

import { mockTemplate } from "../domain/template/template.mock";
import { isTemplate } from "../domain/template/template.validation";

const STORAGE_KEY = "eazy-template-editor:templates";

function getLocalStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    // Access throws in some privacy modes.
    return null;
  }
}

/**
 * Read one locally saved template synchronously, or null when it was never
 * saved (or the stored row is unusable).
 *
 * The asynchronous repository API cannot be used on the Master EDIT bootstrap
 * path: the template has to be chosen while the EDITOR_INIT message is being
 * applied, and `applyEditorInitMessage` is synchronous so it stays unit
 * testable without simulating postMessage.
 */
export function readStoredTemplate(id: string): Template | null {
  const storage = getLocalStorage();

  if (!storage) {
    return null;
  }

  let raw: string | null;

  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }

  if (!raw) {
    return null;
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  const found = parsed.find(
    (entry) => isTemplate(entry) && entry.id === id
  );

  return found && isTemplate(found) ? found : null;
}

/**
 * Drop a locally saved template. Called once its content exists in the
 * database, so a browser copy can never shadow a newer database row.
 */
export function removeStoredTemplate(id: string): void {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  let raw: string | null;

  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return;
  }

  if (!raw) {
    return;
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return;
    }

    storage.setItem(
      STORAGE_KEY,
      JSON.stringify(
        parsed.filter((entry) => !isTemplate(entry) || entry.id !== id)
      )
    );
  } catch {
    // Nothing actionable: an unreadable row is also never restored.
  }
}

export class LocalTemplateRepository
  implements TemplateRepository
{
  private getTemplates(): Template[] {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [mockTemplate];
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(stored);
    } catch {
      throw new InvalidTemplateDataError(
        "Persisted template data is not valid JSON"
      );
    }

    if (!Array.isArray(parsed)) {
      throw new InvalidTemplateDataError(
        "Persisted template data is invalid"
      );
    }

    const templates: Template[] = [];

    for (const entry of parsed) {
      if (!isTemplate(entry)) {
        throw new InvalidTemplateDataError(
          "Persisted template data is invalid"
        );
      }

      templates.push(entry);
    }

    return templates;
  }

  private saveTemplates(templates: Template[]): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(templates)
    );
  }

  async getTemplate(id: string): Promise<Template> {
    const templates = this.getTemplates();

    const template = templates.find(
      (template) => template.id === id
    );

    if (!template) {
      throw new TemplateNotFoundError(id);
    }

    return template;
  }

  async createTemplate(
    input: CreateTemplateInput
  ): Promise<Template> {
    const templates = this.getTemplates();

    const now = new Date().toISOString();

    const template: Template = {
      id: crypto.randomUUID(),

      ...input,

      active: true,

      version: 1,

      createdAt: now,
      updatedAt: now,
    };

    templates.push(template);

    this.saveTemplates(templates);

    return template;
  }

  async updateTemplate(
    id: string,
    input: UpdateTemplateInput
  ): Promise<Template> {
    const templates = this.getTemplates();

    const index = templates.findIndex(
      (template) => template.id === id
    );

    if (index === -1) {
      // Templates can arrive from an external source (e.g. the Master parent
      // page) without ever being recorded in local storage. Save is an upsert
      // so the first local save of such a template succeeds instead of failing
      // with "Template not found". The update contract is partial, but the
      // editor always saves every editable field in one shot (see
      // EditorService.saveTemplate), so the upserted row is complete.
      const created: Template = {
        id,
        ...input,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Template;

      templates.push(created);

      this.saveTemplates(templates);

      return created;
    }

    const existing = templates[index];

    /*
     * Last write wins. The incoming `version` is advisory only, because this
     * store is not the system of record and three independent counters can
     * never agree: this local row (bumped once per local save), the editor
     * store, and Laravel, which emits `version: 1` for every template it
     * hands back (`poster_template` has no version column - see
     * LegacyTemplateAdapter). Every `EDITOR_INIT` / `SAVE_SUCCESS` therefore
     * resets the store to 1 while this row keeps climbing, so a strict check
     * made Save fail permanently for any template after two local saves or one
     * Laravel round trip - a false conflict, never a real concurrent editor.
     * The version stays monotonic so it remains a useful change counter.
     */
    const updated: Template = {
      ...existing,

      ...input,

      version: existing.version + 1,

      updatedAt: new Date().toISOString(),
    };

    templates[index] = updated;

    this.saveTemplates(templates);

    return updated;
  }

  async deleteTemplate(id: string): Promise<void> {
    const templates = this.getTemplates();

    const filtered = templates.filter(
      (template) => template.id !== id
    );

    this.saveTemplates(filtered);
  }

  async duplicateTemplate(
    id: string
  ): Promise<Template> {
    const templates = this.getTemplates();

    const source = templates.find(
      (template) => template.id === id
    );

    if (!source) {
      throw new Error(`Template ${id} not found`);
    }

    const now = new Date().toISOString();

    const duplicate: Template = {
      ...structuredClone(source),

      id: crypto.randomUUID(),

      name: `${source.name} Copy`,

      code: `${source.code}-copy`,

      version: 1,

      createdAt: now,
      updatedAt: now,
    };

    templates.push(duplicate);

    this.saveTemplates(templates);

    return duplicate;
  }
}