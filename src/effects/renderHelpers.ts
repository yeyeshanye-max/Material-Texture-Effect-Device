import { clamp, smoothstep } from '../utils/math';
import { coverRect, getDrawableImageSize } from '../utils/imageMask';

export const clearCanvas = (canvas: HTMLCanvasElement): CanvasRenderingContext2D | null => {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  return ctx;
};

export const sampleMask = (
  mask: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number => {
  if (x < 0 || y < 0 || x >= width || y >= height) {
    return 0;
  }
  return mask[y * width + x];
};

export const innerGlowAt = (
  mask: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): number => {
  const base = sampleMask(mask, width, height, x, y);
  if (base <= 0.02) {
    return 0;
  }

  const step = Math.max(1, Math.floor(radius / 4));
  let strongestOutside = 0;

  for (let oy = -radius; oy <= radius; oy += step) {
    for (let ox = -radius; ox <= radius; ox += step) {
      if (ox * ox + oy * oy > radius * radius) {
        continue;
      }
      const distance = Math.sqrt(ox * ox + oy * oy);
      const falloff = 1 - distance / Math.max(1, radius);
      strongestOutside = Math.max(strongestOutside, (1 - sampleMask(mask, width, height, x + ox, y + oy)) * falloff);
    }
  }

  return clamp(base * strongestOutside);
};

export const edgeBandAt = (
  mask: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
): number => {
  const base = sampleMask(mask, width, height, x, y);
  if (base <= 0.02) {
    return 0;
  }

  const nearOutside =
    1 -
    Math.min(
      sampleMask(mask, width, height, x - radius, y),
      sampleMask(mask, width, height, x + radius, y),
      sampleMask(mask, width, height, x, y - radius),
      sampleMask(mask, width, height, x, y + radius),
    );

  return smoothstep(0.02, 0.6, nearOutside * base);
};

export const writePixel = (
  data: Uint8ClampedArray,
  index: number,
  r: number,
  g: number,
  b: number,
  a: number,
): void => {
  data[index] = Math.round(clamp(r, 0, 255));
  data[index + 1] = Math.round(clamp(g, 0, 255));
  data[index + 2] = Math.round(clamp(b, 0, 255));
  data[index + 3] = Math.round(clamp(a, 0, 255));
};

export const getSourceImageData = (
  image: HTMLImageElement,
  width: number,
  height: number,
): { imageData: ImageData; alphaMask: Float32Array } | null => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }

  const size = getDrawableImageSize(image, width, height);
  const rect = coverRect(size.width, size.height, width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);

  const imageData = ctx.getImageData(0, 0, width, height);
  const alphaMask = new Float32Array(width * height);
  for (let i = 3, p = 0; i < imageData.data.length; i += 4, p += 1) {
    alphaMask[p] = imageData.data[i] / 255;
  }

  return { imageData, alphaMask };
};
