import type {Box} from "../box/box.types";

export interface Template {
  id: string;
  name: string;
  code: string;
  campaign: CampaignType;

  background: TemplateBackground;

  boxes: Box[];

  settings: TemplateSettings;

  active: boolean;

  version: number;

  createdAt: string;
  updatedAt: string;
}

export type CampaignType =
  | "pay-eazy-tent-card"
  | "pay-eazy-standee"
  | "eatout"
  | "foodie-awards";

export interface TemplateBackground {
  imageUrl: string | null;
}

export interface TemplateSettings {
  canvasWidth: number;
  canvasHeight: number;
  backgroundColor: string;
  bleed: number;
}