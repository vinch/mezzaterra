import QRCode from "qrcode";

/** QR code en data URL PNG (couleurs de marque par défaut). */
export function qrDataUrl(
  text: string,
  opts: { size?: number; dark?: string; light?: string; margin?: number } = {},
): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: opts.margin ?? 1,
    width: opts.size ?? 512,
    color: { dark: opts.dark ?? "#256169", light: opts.light ?? "#ffffff" },
  });
}
