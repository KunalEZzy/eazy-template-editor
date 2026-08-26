import type {
  Box,
  ImageBox,
  QRBox,
  TextBox,
} from "./box.types";

export type BoxUpdate =
  | Partial<Omit<TextBox, "id" | "type">>
  | Partial<Omit<QRBox, "id" | "type">>
  | Partial<Omit<ImageBox, "id" | "type">>;

export function isTextBox(
  box: Box
): box is TextBox {
  return box.type === "text";
}

export function isQRBox(
  box: Box
): box is QRBox {
  return box.type === "qr";
}

export function isImageBox(
  box: Box
): box is ImageBox {
  return box.type === "image";
}