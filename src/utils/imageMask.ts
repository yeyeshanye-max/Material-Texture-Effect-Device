import { clamp, contrastCurve } from './math';

export interface MaskResult {
  mask: Float32Array;
  width: number;
  height: number;
}

const makeOffscreenCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const coverRect = (
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
) => {
  const scale = Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
};

export const getDrawableImageSize = (
  image: HTMLImageElement,
  fallbackWidth: number,
  fallbackHeight: number,
): { width: number; height: number } => {
  const width = image.naturalWidth || image.width || fallbackWidth;
  const height = image.naturalHeight || image.height || fallbackHeight;

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
};

export const getImageMask = (
  image: HTMLImageElement,
  width: number,
  height: number,
  invert: boolean,
  contrast = 1,
): MaskResult => {
  const canvas = makeOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  if (!ctx) {
    return { mask: new Float32Array(width * height), width, height };
  }

  ctx.clearRect(0, 0, width, height);
  const size = getDrawableImageSize(image, width, height);
  const rect = coverRect(size.width, size.height, width, height);
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);

  const pixels = ctx.getImageData(0, 0, width, height).data;
  const mask = new Float32Array(width * height);
  let hasTransparentPixels = false;

  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 250) {
      hasTransparentPixels = true;
      break;
    }
  }

  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    const alpha = pixels[i + 3] / 255;
    const luminance = (pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722) / 255;
    const visible = hasTransparentPixels ? alpha : 1 - luminance;
    const value = invert ? 1 - visible : visible;
    mask[p] = contrastCurve(clamp(value), contrast);
  }

  return { mask, width, height };
};

export const placeholderMask = (width: number, height: number): MaskResult => {
  const mask = new Float32Array(width * height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.25;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const ring = Math.abs(Math.hypot(dx, dy) - radius);
      const bar = Math.abs(y - cy) < radius * 0.2 && Math.abs(x - cx) < radius * 1.35;
      mask[y * width + x] = ring < radius * 0.2 || bar ? 1 : 0;
    }
  }

  return { mask, width, height };
};
