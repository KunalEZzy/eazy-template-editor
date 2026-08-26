import type { Template } from "../domain/template/template.types";

import type {
  TemplateRepository,
  UpdateTemplateInput,
} from "../repository/TemplateRepository";

export class EditorService {
  private readonly repository: TemplateRepository;

  constructor(repository: TemplateRepository) {
    this.repository = repository;
  }

  async loadTemplate(
    templateId: string
  ): Promise<Template> {
    return this.repository.getTemplate(templateId);
  }

  async saveTemplate(
    template: Template
  ): Promise<Template> {
    const input: UpdateTemplateInput = {
      name: template.name,
      code: template.code,
      campaign: template.campaign,
      background: template.background,
      boxes: template.boxes,
      settings: template.settings,
      version: template.version,
    };

    return this.repository.updateTemplate(
      template.id,
      input
    );
  }
}