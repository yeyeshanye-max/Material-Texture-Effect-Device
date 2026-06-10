import { clamp, smoothstep } from '../utils/math';

export interface InnerGlowOptions {
  color: string;
  opacity: number;
  size: number;
  choke: number;
  source: 'center' | 'edge';
  range: number;
  centerX: number;
  centerY: number;
  gamma: number;
  blendMode: 'normal' | 'screen';
}

export interface InnerGlowResult {
  blendMode: 'normal' | 'screen';
  color: [number, number, number];
  mask: Float32Array;
}

const maxGlowLongEdge = 760;

const parseHexColor = (color: string): [number, number, number] => {
  const normalized = color.replace('#', '');
  if (normalized.length !== 6) {
    return [255, 255, 255];
  }

  return [
    Number.parseInt(normalized.slice(0, 2), 16),
    Number.parseInt(normalized.slice(2, 4), 16),
    Number.parseInt(normalized.slice(4, 6), 16),
  ];
};

const buildGaussianKernel = (radius: number): Float32Array => {
  const safeRadius = Math.max(0, Math.min(80, Math.round(radius)));
  if (safeRadius === 0) {
    return new Float32Array([1]);
  }

  const sigma = Math.max(0.8, safeRadius / 2.5);
  const kernel = new Float32Array(safeRadius * 2 + 1);
  let sum = 0;

  for (let i = -safeRadius; i <= safeRadius; i += 1) {
    const value = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + safeRadius] = value;
    sum += value;
  }

  for (let i = 0; i < kernel.length; i += 1) {
    kernel[i] /= sum;
  }

  return kernel;
};

const gaussianBlur = (source: Float32Array, width: number, height: number, radius: number): Float32Array => {
  const kernel = buildGaussianKernel(radius);
  const kernelRadius = Math.floor(kernel.length / 2);
  if (kernelRadius === 0) {
    return new Float32Array(source);
  }

  const temp = new Float32Array(source.length);
  const output = new Float32Array(source.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      for (let k = -kernelRadius; k <= kernelRadius; k += 1) {
        const sx = Math.min(width - 1, Math.max(0, x + k));
        total += source[y * width + sx] * kernel[k + kernelRadius];
      }
      temp[y * width + x] = total;
    }
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let total = 0;
      for (let k = -kernelRadius; k <= kernelRadius; k += 1) {
        const sy = Math.min(height - 1, Math.max(0, y + k));
        total += temp[sy * width + x] * kernel[k + kernelRadius];
      }
      output[y * width + x] = total;
    }
  }

  return output;
};

const createInteriorDistance = (alphaMask: Float32Array, width: number, height: number): Float32Array => {
  const maxDistance = width + height;
  const distance = new Float32Array(alphaMask.length);
  const diagonal = Math.SQRT2;

  for (let i = 0; i < alphaMask.length; i += 1) {
    distance[i] = alphaMask[i] > 0.02 ? maxDistance : 0;
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      if (distance[p] === 0) {
        continue;
      }
      let best = distance[p];
      if (x > 0) best = Math.min(best, distance[p - 1] + 1);
      if (y > 0) best = Math.min(best, distance[p - width] + 1);
      if (x > 0 && y > 0) best = Math.min(best, distance[p - width - 1] + diagonal);
      if (x < width - 1 && y > 0) best = Math.min(best, distance[p - width + 1] + diagonal);
      distance[p] = best;
    }
  }

  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const p = y * width + x;
      if (distance[p] === 0) {
        continue;
      }
      let best = distance[p];
      if (x < width - 1) best = Math.min(best, distance[p + 1] + 1);
      if (y < height - 1) best = Math.min(best, distance[p + width] + 1);
      if (x < width - 1 && y < height - 1) best = Math.min(best, distance[p + width + 1] + diagonal);
      if (x > 0 && y < height - 1) best = Math.min(best, distance[p + width - 1] + diagonal);
      distance[p] = best;
    }
  }

  return distance;
};

const getMaxInteriorDistance = (distance: Float32Array): number => {
  let maxDistance = 0;
  for (let i = 0; i < distance.length; i += 1) {
    if (distance[i] > maxDistance) {
      maxDistance = distance[i];
    }
  }
  return Math.max(1, maxDistance);
};

const sampleBilinear = (source: Float32Array, width: number, height: number, x: number, y: number): number => {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
  const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
  const tx = x - x0;
  const ty = y - y0;
  const top = source[y0 * width + x0] * (1 - tx) + source[y0 * width + x1] * tx;
  const bottom = source[y1 * width + x0] * (1 - tx) + source[y1 * width + x1] * tx;
  return top * (1 - ty) + bottom * ty;
};

const resizeMask = (
  source: Float32Array,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): Float32Array => {
  if (sourceWidth === targetWidth && sourceHeight === targetHeight) {
    return new Float32Array(source);
  }

  const output = new Float32Array(targetWidth * targetHeight);
  const scaleX = sourceWidth / targetWidth;
  const scaleY = sourceHeight / targetHeight;

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      output[y * targetWidth + x] = sampleBilinear(
        source,
        sourceWidth,
        sourceHeight,
        (x + 0.5) * scaleX - 0.5,
        (y + 0.5) * scaleY - 0.5,
      );
    }
  }

  return output;
};

export const applyInnerGlow = (
  alphaMask: Float32Array,
  width: number,
  height: number,
  options: InnerGlowOptions,
): InnerGlowResult => {
  const opacity = clamp(options.opacity);
  const size = Math.max(0, options.size);
  if (opacity <= 0 || size <= 0) {
    return {
      blendMode: options.blendMode,
      color: parseHexColor(options.color),
      mask: new Float32Array(alphaMask.length),
    };
  }

  const longEdge = Math.max(width, height);
  const scale = longEdge > maxGlowLongEdge ? maxGlowLongEdge / longEdge : 1;
  const workWidth = Math.max(1, Math.round(width * scale));
  const workHeight = Math.max(1, Math.round(height * scale));
  const workMask = scale < 1 ? resizeMask(alphaMask, width, height, workWidth, workHeight) : alphaMask;
  const workSize = size * scale;
  const distance = createInteriorDistance(workMask, workWidth, workHeight);
  const maxInteriorDistance = getMaxInteriorDistance(distance);
  const glow = new Float32Array(workMask.length);
  const range = Math.max(0.05, options.range);
  const gamma = Math.max(0.05, options.gamma);
  const choke = clamp(options.choke);
  const centerCoverage = clamp(workSize / Math.max(1, maxInteriorDistance * range));
  const centerStart = clamp(1 - centerCoverage);
  const edgeReach = Math.max(1, workSize * range);
  const glowCenterX = clamp(options.centerX / 100) * (workWidth - 1);
  const glowCenterY = clamp(options.centerY / 100) * (workHeight - 1);
  const maxCenterRadius = Math.max(
    1,
    Math.hypot(Math.max(glowCenterX, workWidth - 1 - glowCenterX), Math.max(glowCenterY, workHeight - 1 - glowCenterY)),
  );

  for (let y = 0; y < workHeight; y += 1) {
    for (let x = 0; x < workWidth; x += 1) {
      const i = y * workWidth + x;
      const alpha = workMask[i];
      if (alpha <= 0.02) {
        continue;
      }

      const edgeDistance = clamp(distance[i] / maxInteriorDistance);
      const radialDistance = 1 - clamp(Math.hypot(x - glowCenterX, y - glowCenterY) / maxCenterRadius);
      const sourceValue =
        options.source === 'center'
          ? smoothstep(centerStart, 1, Math.max(edgeDistance * 0.45, radialDistance))
          : 1 - clamp(distance[i] / edgeReach);
      const concentrated = smoothstep(choke * 0.85, 1, sourceValue);
      glow[i] = Math.pow(concentrated, gamma) * alpha;
    }
  }

  const blurred = gaussianBlur(glow, workWidth, workHeight, workSize * 0.45);
  const output = new Float32Array(alphaMask.length);

  if (scale < 1) {
    const scaleX = workWidth / width;
    const scaleY = workHeight / height;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = y * width + x;
        output[i] = clamp(sampleBilinear(blurred, workWidth, workHeight, x * scaleX, y * scaleY) * alphaMask[i] * opacity);
      }
    }
  } else {
    for (let i = 0; i < output.length; i += 1) {
      output[i] = clamp(blurred[i] * alphaMask[i] * opacity);
    }
  }

  return {
    blendMode: options.blendMode,
    color: parseHexColor(options.color),
    mask: output,
  };
};

export const blendInnerGlowPixel = (
  base: number,
  glowColor: number,
  glowAlpha: number,
  blendMode: 'normal' | 'screen',
): number => {
  if (glowAlpha <= 0) {
    return base;
  }

  const blended = blendMode === 'screen' ? 255 - ((255 - base) * (255 - glowColor)) / 255 : glowColor;
  return base * (1 - glowAlpha) + blended * glowAlpha;
};
