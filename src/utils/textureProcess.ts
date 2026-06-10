import { clamp, fractalNoise, smoothstep } from './math';
import { getDrawableImageSize } from './imageMask';

const makeOffscreenCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export const getTextureMask = (
  textureImage: HTMLImageElement | null,
  width: number,
  height: number,
  scale: number,
  threshold: number,
  invert: boolean,
  seed: number,
  detail: number,
): Float32Array => {
  const output = new Float32Array(width * height);

  if (!textureImage) {
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = fractalNoise(x / 18, y / 18, seed, detail);
        const processed = invert ? 1 - value : value;
        output[y * width + x] = smoothstep(threshold - 0.12, threshold + 0.12, processed);
      }
    }
    return output;
  }

  const canvas = makeOffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return output;
  }

  const sourceSize = getDrawableImageSize(textureImage, width, height);
  const sourceLongEdge = Math.max(sourceSize.width, sourceSize.height);
  const baseLongEdge = Math.max(96, Math.min(Math.max(width, height) * 0.75, 900));
  const normalized = baseLongEdge / Math.max(1, sourceLongEdge);
  const sourceWidth = sourceSize.width * normalized;
  const sourceHeight = sourceSize.height * normalized;
  const tileWidth = Math.max(16, sourceWidth * scale);
  const tileHeight = Math.max(16, sourceHeight * scale);

  for (let y = -tileHeight; y < height + tileHeight; y += tileHeight) {
    for (let x = -tileWidth; x < width + tileWidth; x += tileWidth) {
      ctx.drawImage(textureImage, x, y, tileWidth, tileHeight);
    }
  }

  const pixels = ctx.getImageData(0, 0, width, height).data;
  for (let i = 0, p = 0; i < pixels.length; i += 4, p += 1) {
    const alpha = pixels[i + 3] / 255;
    const luminance = (pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722) / 255;
    const value = alpha < 0.98 ? alpha : clamp(luminance);
    const processed = invert ? 1 - value : value;
    output[p] = smoothstep(threshold - 0.1, threshold + 0.1, processed);
  }

  return output;
};
