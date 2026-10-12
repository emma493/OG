/**
 * Client-side thumbnail baker — ported from Admin src/lib/previewBake.ts.
 * Cover-crop photo into 1200x630 + play button + duration pill -> JPEG dataURL.
 */

export const PREVIEW_W = 1200;
export const PREVIEW_H = 630;

export function randomDuration(): string {
  const r = Math.random();
  const mins = r < 0.45 ? 1 + Math.floor(Math.random() * 3) : r < 0.8 ? 4 + Math.floor(Math.random() * 3) : 7 + Math.floor(Math.random() * 3);
  const secs = Math.floor(Math.random() * 60);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load-failed'));
    img.src = url;
  });
}

function viaWeservProxy(sourceUrl: string): string {
  const stripped = sourceUrl.trim().replace(/^https?:\/\//i, '');
  return `https://wsrv.nl/?url=${encodeURIComponent(stripped)}&w=${PREVIEW_W}&h=${PREVIEW_H}&fit=cover&output=jpg`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function bakePreview(sourceUrl: string, duration: string): Promise<string> {
  const url = sourceUrl.trim();
  if (!url) throw new Error('Paste a photo URL first.');
  let img: HTMLImageElement;
  try {
    img = await loadImage(url);
  } catch {
    img = await loadImage(viaWeservProxy(url));
  }
  const canvas = document.createElement('canvas');
  canvas.width = PREVIEW_W;
  canvas.height = PREVIEW_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available in this browser.');

  const scale = Math.max(PREVIEW_W / img.naturalWidth, PREVIEW_H / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);
  ctx.drawImage(img, (PREVIEW_W - dw) / 2, (PREVIEW_H - dh) / 2, dw, dh);

  ctx.fillStyle = 'rgba(0,0,0,0.14)';
  ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H);

  const grad = ctx.createLinearGradient(0, PREVIEW_H - 190, 0, PREVIEW_H);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, PREVIEW_H - 190, PREVIEW_W, 190);

  const cx = PREVIEW_W / 2;
  const cy = PREVIEW_H / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 6;
  ctx.beginPath();
  ctx.arc(cx, cy, 92, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.62)';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, 92, 0, Math.PI * 2);
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.stroke();

  const triH = 76;
  const triW = 64;
  ctx.beginPath();
  ctx.moveTo(cx - triW * 0.38, cy - triH / 2);
  ctx.lineTo(cx - triW * 0.38, cy + triH / 2);
  ctx.lineTo(cx + triW * 0.62, cy);
  ctx.closePath();
  ctx.fillStyle = '#fff';
  ctx.fill();

  const label = duration.trim() || '2:56';
  ctx.font = '700 44px Roboto, Arial, Helvetica, sans-serif';
  const textW = ctx.measureText(label).width;
  const padX = 26;
  const pillW = textW + padX * 2;
  const pillH = 68;
  const pillX = 36;
  const pillY = PREVIEW_H - pillH - 36;
  ctx.fillStyle = 'rgba(0,0,0,0.82)';
  roundRect(ctx, pillX, pillY, pillW, pillH, 14);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, pillX + padX, pillY + pillH / 2 + 2);

  let out = canvas.toDataURL('image/jpeg', 0.82);
  if (out.length > 950_000) out = canvas.toDataURL('image/jpeg', 0.7);
  return out;
}
