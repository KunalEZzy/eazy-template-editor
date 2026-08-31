import type {
  TextVariable,
  QRVariable,
} from "./variables.types";

export interface TextVariableDefaults {
  type: "text";

  x: number;
  y: number;
  width: number;
  height: number;

  fontFamily: string;
  fontSize: number;
  fontWeight: number;

  color: string;

  textAlign:
    | "left"
    | "center"
    | "right";

  textTransform:
    | "none"
    | "capitalize"
    | "uppercase"
    | "lowercase";

  lineHeight: number;
  letterSpacing: number;
}

export interface QRVariableDefaults {
  type: "qr";

  x: number;
  y: number;
  width: number;
  height: number;

  foregroundColor: string;
  backgroundColor: string;
}

export type VariableDefaults =
  | TextVariableDefaults
  | QRVariableDefaults;

export const VARIABLE_DEFAULTS: Record<
  TextVariable | QRVariable,
  VariableDefaults
> = {
  // ------------------------------------------
  // TEXT VARIABLES
  // ------------------------------------------

  resNameNL: {
    type: "text",

    x: 10,
    y: 10,
    width: 80,
    height: 10,

    fontFamily: "Arial",
    fontSize: 48,
    fontWeight: 700,

    color: "#000000",

    textAlign: "center",
    textTransform: "none",

    lineHeight: 1.2,
    letterSpacing: 0,
  },

  resNameL: {
    type: "text",

    x: 10,
    y: 10,
    width: 80,
    height: 10,

    fontFamily: "Arial",
    fontSize: 48,
    fontWeight: 700,

    color: "#000000",

    textAlign: "center",
    textTransform: "none",

    lineHeight: 1.2,
    letterSpacing: 0,
  },

  discount: {
    type: "text",

    x: 20,
    y: 30,
    width: 60,
    height: 12,

    fontFamily: "Arial",
    fontSize: 64,
    fontWeight: 700,

    color: "#FF0000",

    textAlign: "center",
    textTransform: "uppercase",

    lineHeight: 1.2,
    letterSpacing: 0,
  },

  resLoc: {
    type: "text",

    x: 15,
    y: 45,
    width: 70,
    height: 8,

    fontFamily: "Arial",
    fontSize: 28,
    fontWeight: 400,

    color: "#333333",

    textAlign: "center",
    textTransform: "none",

    lineHeight: 1.2,
    letterSpacing: 0,
  },

  foodCat: {
    type: "text",

    x: 15,
    y: 55,
    width: 70,
    height: 8,

    fontFamily: "Arial",
    fontSize: 28,
    fontWeight: 400,

    color: "#333333",

    textAlign: "center",
    textTransform: "none",

    lineHeight: 1.2,
    letterSpacing: 0,
  },

  // ------------------------------------------
  // QR VARIABLES
  // ------------------------------------------

  resQR: {
    type: "qr",

    x: 35,
    y: 65,
    width: 20,
    height: 20,

    foregroundColor: "#000000",
    backgroundColor: "#FFFFFF",
  },

  resQRPayEazy: {
    type: "qr",

    x: 35,
    y: 65,
    width: 20,
    height: 20,

    foregroundColor: "#000000",
    backgroundColor: "#FFFFFF",
  },

  foodQR: {
    type: "qr",

    x: 35,
    y: 65,
    width: 20,
    height: 20,

    foregroundColor: "#000000",
    backgroundColor: "#FFFFFF",
  },
};