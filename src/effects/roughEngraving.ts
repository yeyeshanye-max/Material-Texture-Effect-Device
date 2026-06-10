import type { RenderInput } from '../types/effects';
import { getImageMask } from '../utils/imageMask';
import { clamp, seededNoise, smoothstep } from '../utils/math';
import { applyInnerGlow, blendInnerGlowPixel } from './applyInnerGlow';
import { clearCanvas, sampleMask, writePixel } from './renderHelpers';

export const renderRoughEngraving = ({ canvas, patternImage, params }: RenderInput): void => {
  const ctx = clearCanvas(canvas);
  if (!ctx || !patternImage) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const roughSizePx = (Math.min(width, height) * params.grainSize) / 100;
  const roughDetail = params.roughness;
  const dotAmount = clamp(params.lineDensity / 100);
  const coarseAmount = clamp(params.coarseGrainAmount / 100);
  const { mask } = getImageMask(patternImage, width, height, false, 1);
  const roughCell = roughDetail > 0 ? Math.max(1, 96 / roughDetail) : 999999;
  const fineCell = Math.max(2.2, 8 - dotAmount * 4.6);
  const coarseCell = Math.max(7, 26 - coarseAmount * 12);
  const pinholeAmount = clamp(dotAmount);
  const roughMask = new Float32Array(width * height);
  const effectAmount = clamp(Math.max(params.grainSize / 2, params.roughness / 20, dotAmount, coarseAmount));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const blockX = Math.floor(x / roughCell);
      const blockY = Math.floor(y / roughCell);
      const offsetStrength = roughSizePx;
      const offsetX = (seededNoise(blockX, blockY, params.randomSeed + 17) - 0.5) * offsetStrength;
      const offsetY = (seededNoise(blockX, blockY, params.randomSeed + 41) - 0.5) * offsetStrength;
      const displaced = sampleMask(mask, width, height, Math.round(x + offsetX), Math.round(y + offsetY));
      const solid = smoothstep(0.08, 0.82, displaced);
      const edgeNoise = seededNoise(Math.floor(x / 2), Math.floor(y / 2), params.randomSeed + 211);
      const edgeBand =
        1 -
        Math.min(
          sampleMask(mask, width, height, x - 2, y),
          sampleMask(mask, width, height, x + 2, y),
          sampleMask(mask, width, height, x, y - 2),
          sampleMask(mask, width, height, x, y + 2),
        );
      const edgeCut =
        edgeBand *
        Math.min(roughSizePx / 12, 1) *
        smoothstep(0.22, 1, edgeNoise);
      roughMask[p] = clamp(solid - edgeCut);
    }
  }

  const innerGlow = applyInnerGlow(roughMask, width, height, {
    blendMode: 'normal',
    centerX: params.innerGlowCenterX ?? 50,
    centerY: params.innerGlowCenterY ?? 50,
    choke: params.innerGlowChoke,
    color: params.innerGlowColor,
    gamma: 1,
    opacity: params.innerGlowOpacity,
    range: params.innerGlowRangeAmount,
    size: params.innerGlowSize,
    source: 'center',
  });
  const imageData = ctx.createImageData(width, height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const i = p * 4;
      const baseMask = roughMask[p];
      if (baseMask <= 0.01) {
        continue;
      }

      const grainX = Math.floor(x / fineCell);
      const grainY = Math.floor(y / fineCell);
      const noise = seededNoise(grainX, grainY, params.randomSeed);
      const cellX = (x % fineCell) / fineCell - 0.5;
      const cellY = (y % fineCell) / fineCell - 0.5;
      const dotFalloff = 1 - Math.min(1, Math.hypot(cellX, cellY) * (1.55 + seededNoise(grainX, grainY, params.randomSeed + 301)));
      const speckle = seededNoise(Math.floor(x / 2.4), Math.floor(y / 2.4), params.randomSeed + 503);
      const clusterNoise = seededNoise(Math.floor(x / (fineCell * 3.4)), Math.floor(y / (fineCell * 3.4)), params.randomSeed + 71);
      const dotThreshold = 0.78 - pinholeAmount * 0.48;
      const pinhole =
        dotAmount > 0
          ? smoothstep(dotThreshold, 1, noise * 0.36 + speckle * 0.28 + clusterNoise * 0.16 + dotFalloff * 0.2)
          : 0;
      const coarseX = Math.floor(x / coarseCell);
      const coarseY = Math.floor(y / coarseCell);
      const coarseNoise = seededNoise(coarseX, coarseY, params.randomSeed + 907);
      const coarseCellX = (x % coarseCell) / coarseCell - 0.5;
      const coarseCellY = (y % coarseCell) / coarseCell - 0.5;
      const coarseFalloff =
        1 - Math.min(1, Math.hypot(coarseCellX, coarseCellY) * (1.1 + seededNoise(coarseX, coarseY, params.randomSeed + 1103)));
      const coarseCluster = seededNoise(
        Math.floor(x / (coarseCell * 2.1)),
        Math.floor(y / (coarseCell * 2.1)),
        params.randomSeed + 1201,
      );
      const coarseThreshold = 0.82 - coarseAmount * 0.5;
      const coarsePinhole =
        coarseAmount > 0 ? smoothstep(coarseThreshold, 1, coarseNoise * 0.48 + coarseCluster * 0.18 + coarseFalloff * 0.34) : 0;
      const copperCut = clamp(
        pinhole * (0.45 + pinholeAmount * 0.55) +
          coarsePinhole * coarseAmount * 1.05,
      );
      const tone = 9;
      const glowAlpha = innerGlow.mask[p];
      const r = blendInnerGlowPixel(tone, innerGlow.color[0], glowAlpha, innerGlow.blendMode);
      const g = blendInnerGlowPixel(tone, innerGlow.color[1], glowAlpha, innerGlow.blendMode);
      const b = blendInnerGlowPixel(tone, innerGlow.color[2], glowAlpha, innerGlow.blendMode);
      const alpha = baseMask * 255 * (1 - copperCut * 0.9 * effectAmount);

      writePixel(imageData.data, i, r, g, b, alpha);
    }
  }

  ctx.putImageData(imageData, 0, 0);
};
