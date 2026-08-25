import type { Template } from "../domain/template/template.types";

import type {
  CreateTemplateInput,
  TemplateRepository,
  UpdateTemplateInput,
} from "./TemplateRepository";

import { mockTemplate } from "../domain/template/template.mock";

const STORAGE_KEY = "eazy-template-editor:templates";

export class LocalTemplateRepository
  implements TemplateRepository
{
  private getTemplates(): Template[] {
    const stored = localStorage.getItem(STORAGE_KEY);

    if (!stored) {
      return [mockTemplate];
    }

    return JSON.parse(stored) as Template[];
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
      throw new Error(`Template ${id} not found`);
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
      throw new Error(`Template ${id} not found`);
    }

    const existing = templates[index];

    if (existing.version !== input.version) {
      throw new Error(
        "Template has been modified by another session"
      );
    }

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