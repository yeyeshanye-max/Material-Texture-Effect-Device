import type { RenderInput } from '../types/effects';
import { clamp, fractalNoise, smoothstep } from '../utils/math';
import { getTextureMask } from '../utils/textureProcess';
import { applyInnerGlow, blendInnerGlowPixel } from './applyInnerGlow';
import { clearCanvas, edgeBandAt, getSourceImageData, writePixel } from './renderHelpers';

export const renderTornTextureEngraving = ({
  canvas,
  patternImage,
  textureImage,
  params,
}: RenderInput): void => {
  const ctx = clearCanvas(canvas);
  if (!ctx || !patternImage) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const effectiveTextureScale = params.textureScale > 0 ? params.textureScale / 100 : 1;
  const effectiveTextureThreshold =
    params.textureIntensity > 0 && params.textureThreshold === 0 ? 0.5 : params.textureThreshold;
  const effectiveTornDetail =
    (params.textureIntensity > 0 || params.tornEdgeStrength > 0) && params.tornEdgeDetail === 0
      ? 0.5
      : params.tornEdgeDetail;
  const source = getSourceImageData(patternImage, width, height);
  if (!source) {
    return;
  }
  const mask = source.alphaMask;
  const textureMask = getTextureMask(
    textureImage,
    width,
    height,
    effectiveTextureScale,
    effectiveTextureThreshold,
    params.textureInvert,
    params.randomSeed + 91,
    effectiveTornDetail,
  );

  const imageData = ctx.createImageData(width, height);
  const innerGlow = applyInnerGlow(mask, width, height, {
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
  const tearRadius = Math.max(1, Math.round(2 + effectiveTornDetail * 11));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x;
      const i = p * 4;
      const baseMask = mask[p];
      if (baseMask <= 0.01) {
        continue;
      }

      const textureKeep = textureMask[p];
      const edgeBand = edgeBandAt(mask, width, height, x, y, tearRadius);
      const textureBreakup = smoothstep(0.08, 0.92, 1 - textureKeep);
      const textureCut = textureBreakup * params.textureIntensity;
      const tearNoise = fractalNoise(x / 7, y / 7, params.randomSeed + 203, effectiveTornDetail);
      const tornTexture = smoothstep(0.22, 0.82, tearNoise * 0.55 + textureBreakup * 0.45);
      const tornCut = edgeBand * params.tornEdgeStrength * tornTexture;
      const retained = clamp(1 - textureCut * 0.95 - tornCut * 0.98);
      const alpha = clamp(baseMask * retained);
      if (alpha <= 0.01) {
        continue;
      }

      const glowAlpha = innerGlow.mask[p];
      const tone = 9;
      const sourceAlpha = source.imageData.data[i + 3];
      const r = blendInnerGlowPixel(tone, innerGlow.color[0], glowAlpha, innerGlow.blendMode);
      const g = blendInnerGlowPixel(tone, innerGlow.color[1], glowAlpha, innerGlow.blendMode);
      const b = blendInnerGlowPixel(tone, innerGlow.color[2], glowAlpha, innerGlow.blendMode);

      writePixel(imageData.data, i, r, g, b, sourceAlpha * alpha);
    }
  }

  ctx.putImageData(imageData, 0, 0);
};
