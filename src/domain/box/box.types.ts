import type {
  TextVariable,
  QRVariable,
} from "../variables/variables.types";

export interface BaseBox {
  id: string;

  x: number;
  y: number;

  width: number;
  height: number;

  rotation: number;
  opacity: number;

  zIndex: number;

  locked: boolean;
  visible: boolean;
}

export interface TextBox extends BaseBox {
  type: "text";

  variable: TextVariable;

  fontFamily: string;
  fontSize: number;
  fontWeight: number;

  color: string;
  color2?: string;

  textAlign: "left" | "center" | "right";

  textTransform:
    | "none"
    | "capitalize"
    | "uppercase"
    | "lowercase";

  lineHeight: number;
  letterSpacing: number;
}

export interface QRBox extends BaseBox {
  type: "qr";

  variable: QRVariable;

  foregroundColor: string;
  backgroundColor: string;

  logoUrl?: string;
}

export interface ImageBox extends BaseBox {
  type: "image";

  imageUrl: string;

  fit: "contain" | "cover" | "fill";
}

export type Box =
  | TextBox
  | QRBox
  | ImageBox;