import type { Template } from "../domain/template/template.types";

export class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`Template ${templateId} not found`);
    this.name = "TemplateNotFoundError";
  }
}

export class InvalidTemplateDataError extends Error {
  constructor(message = "Persisted template data is invalid") {
    super(message);
    this.name = "InvalidTemplateDataError";
  }
}

export interface CreateTemplateInput {
  name: string;
  code: string;
  campaign: Template["campaign"];
  background: Template["background"];
  boxes: Template["boxes"];
  settings: Template["settings"];
}

export interface UpdateTemplateInput {
  name?: string;
  code?: string;
  campaign?: Template["campaign"];
  background?: Template["background"];
  boxes?: Template["boxes"];
  settings?: Template["settings"];
  version: number;
}

export interface TemplateRepository {
  getTemplate(id: string): Promise<Template>;

  createTemplate(
    input: CreateTemplateInput
  ): Promise<Template>;

  updateTemplate(
    id: string,
    input: UpdateTemplateInput
  ): Promise<Template>;

  deleteTemplate(id: string): Promise<void>;

  duplicateTemplate(id: string): Promise<Template>;
}