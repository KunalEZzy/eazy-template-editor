import type { Template } from "../domain/template/template.types";

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