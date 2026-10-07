function config() {
  const cloud =
    process.env.CLOUDINARY_CLOUD_NAME ||
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const key =
      process.env.CLOUDINARY_API_KEY ||
      process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
    secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !key || !secret)
    throw new Error("Cloudinary server credentials are not configured");
  return { cloud, key, secret };
}
async function cloudinary(
  action: string,
  fields: Record<string, string>,
  image?: Buffer,
) {
  const { cloud, key, secret } = config();
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  if (image)
    form.set(
      "file",
      new Blob([new Uint8Array(image)], { type: "image/webp" }),
      "business.webp",
    );
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/${action}`,
    {
      method: "POST",
      // Server-only HTTPS authentication avoids signatures depending on the host clock.
      headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` },
      body: form,
      redirect: "error",
      signal: AbortSignal.timeout(20000),
    },
  );
  if (!response.ok)
    throw new Error(`Cloudinary ${action} failed (${response.status})`);
  return response.json();
}
export async function uploadBusinessImage(image: Buffer, publicId: string) {
  const preset = process.env.CLOUDINARY_BUSINESS_UPLOAD_PRESET;
  const result = await cloudinary(
    "upload",
    {
      public_id: publicId,
      overwrite: "false",
      ...(preset ? { upload_preset: preset } : {}),
    },
    image,
  );
  if (
    typeof result.secure_url !== "string" ||
    !result.secure_url.startsWith("https://res.cloudinary.com/") ||
    result.public_id !== publicId
  )
    throw new Error("Invalid Cloudinary response");
  return {
    imageUrl: result.secure_url as string,
    imagePublicId: result.public_id as string,
  };
}
export async function deleteBusinessImage(publicId: string) {
  await cloudinary("destroy", { public_id: publicId });
}
