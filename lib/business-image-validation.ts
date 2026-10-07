import sharp from "sharp";
import { MAX_BUSINESS_IMAGE_BYTES } from "./business-directory-policy";

export async function validateBusinessImage(file: File) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size === 0 ||
    file.size > MAX_BUSINESS_IMAGE_BYTES
  )
    throw new Error("Use one JPEG, PNG or WebP image up to 2 MB.");
  const bytes = Buffer.from(await file.arrayBuffer());
  // Decode rather than trusting the browser MIME type; strip metadata and bound dimensions.
  const decoder = sharp(bytes, { limitInputPixels: 25000000, animated: false });
  const meta = await decoder.metadata();
  if (
    !["jpeg", "png", "webp"].includes(meta.format ?? "") ||
    (meta.pages ?? 1) > 1
  )
    throw new Error("Invalid image.");
  const image = await decoder
    .rotate()
    .resize({
      width: 1200,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 82 })
    .toBuffer();
  return { image, mimeType: "image/webp" };
}
