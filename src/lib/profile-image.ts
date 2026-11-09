import "server-only";
import sharp from "sharp";
export const MAX_PHOTO_BYTES = 1_000_000;
/** Decode, limit image dimensions and strip metadata instead of trusting file names or MIME labels. */
export async function normalizeProfilePhoto(bytes: Uint8Array) {
  if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) throw new Error("Choose a JPEG, PNG or WebP image up to 1 MB.");
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (!jpeg && !png && !webp) throw new Error("Only JPEG, PNG or WebP photos are supported.");
  const image = sharp(bytes, { limitInputPixels: 16_777_216, failOn: "warning" });
  const metadata = await image.metadata();
  if (!["jpeg", "png", "webp"].includes(metadata.format ?? "") || (metadata.pages ?? 1) > 1) throw new Error("Use a still JPEG, PNG or WebP image.");
  const normalized = await image.rotate().resize({ width: 512, height: 512, fit: "inside", withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
  return new Uint8Array(normalized);
}
