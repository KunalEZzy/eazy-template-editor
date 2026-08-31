import QRCode from "qrcode";

export interface QRPreviewOptions {
  width: number;
  foregroundColor: string;
  backgroundColor: string;
}

export async function generateQRPreview(
  value: string,
  options: QRPreviewOptions
): Promise<string> {
  return QRCode.toDataURL(value, {
    width: options.width,
    margin: 0,
    color: {
      dark: options.foregroundColor,
      light: options.backgroundColor,
    },
  });
}