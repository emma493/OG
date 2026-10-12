/**
 * Cloudinary unsigned upload — ported from Admin src/lib/cloudinary.ts.
 * Env: VITE_CLOUDINARY_CLOUD_NAME / VITE_CLOUDINARY_PRESET.
 */

const CLOUD_NAME = (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_CLOUDINARY_CLOUD_NAME || 'nonzehj3';
const UPLOAD_PRESET = (import.meta as unknown as { env?: Record<string, string> })?.env?.VITE_CLOUDINARY_PRESET || 'shortxx_preview';

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/.exec(dataUrl);
  if (!m) throw new Error('Baked image data is missing.');
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1] });
}

export async function uploadBakedImage(dataUrl: string): Promise<CloudinaryUploadResult> {
  const blob = dataUrlToBlob(dataUrl);
  const form = new FormData();
  form.append('file', blob, 'preview.jpg');
  form.append('upload_preset', UPLOAD_PRESET);
  let res: Response;
  try {
    res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body: form,
    });
  } catch {
    throw new Error('Upload failed — check your connection and try again.');
  }
  let body: { secure_url?: string; public_id?: string; error?: { message?: string } } | null = null;
  try {
    body = (await res.json()) as typeof body;
  } catch {
    body = null;
  }
  if (!res.ok || !body?.secure_url) {
    const detail = body?.error?.message || `HTTP ${res.status}`;
    throw new Error(`Cloudinary upload failed (${detail}). Check the preset is Unsigned.`);
  }
  return { secureUrl: body.secure_url, publicId: body.public_id ?? '' };
}
