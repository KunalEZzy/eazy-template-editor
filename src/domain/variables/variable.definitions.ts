import type {
  TextVariable,
  QRVariable,
} from "./variables.types";

export type TemplateVariableType =
  | "text"
  | "qr";

export interface TextVariableDefinition {
  key: TextVariable;
  label: string;
  type: "text";
}

export interface QRVariableDefinition {
  key: QRVariable;
  label: string;
  type: "qr";
}

export type VariableDefinition =
  | TextVariableDefinition
  | QRVariableDefinition;

export const VARIABLE_DEFINITIONS: VariableDefinition[] = [
  {
    key: "resNameNL",
    label: "Restaurant Name",
    type: "text",
  },

  {
    key: "resNameL",
    label: "Restaurant Name with Location",
    type: "text",
  },

  {
    key: "discount",
    label: "Booking Discount",
    type: "text",
  },

  {
    key: "resQRPayEazy",
    label: "Restaurant PayEazy QR Code",
    type: "qr",
  },

  {
    key: "resQR",
    label: "Restaurant Detail QR Code",
    type: "qr",
  },

  {
    key: "foodQR",
    label: "Foodie Awards QR",
    type: "qr",
  },

  {
    key: "foodCat",
    label: "Foodie Awards Category",
    type: "text",
  },

  {
    key: "resLoc",
    label: "Restaurant Location",
    type: "text",
  },
];

export function getVariableDefinition(
  key: TextVariable | QRVariable
): VariableDefinition | undefined {
  return VARIABLE_DEFINITIONS.find(
    (definition) => definition.key === key
  );
}