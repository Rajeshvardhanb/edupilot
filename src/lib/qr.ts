import "server-only";
import QRCode from "qrcode";

/** Inline SVG markup for a QR code (rendered on the server; no client script). */
export function qrSvg(text: string) {
  return QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
}
