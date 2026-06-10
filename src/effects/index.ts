import type { EffectId, RenderInput } from '../types/effects';
import { coverRect, getDrawableImageSize } from '../utils/imageMask';
import { renderRoughEngraving } from './roughEngraving';
import { renderTornTextureEngraving } from './tornTextureEngraving';

const drawOriginalImage = (input: RenderInput): void => {
  const { canvas, patternImage } = input;
  const ctx = canvas.getContext('2d');
  if (!ctx || !patternImage) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const size = getDrawableImageSize(patternImage, canvas.width, canvas.height);
  const rect = coverRect(size.width, size.height, canvas.width, canvas.height);
  ctx.drawImage(patternImage, rect.x, rect.y, rect.width, rect.height);
};

const hasActiveEffect = (effectId: EffectId, input: RenderInput): boolean => {
  const { params } = input;
  if (effectId === 'roughEngraving') {
    return (
      params.roughness > 0 ||
      params.lineDensity > 0 ||
      params.coarseGrainAmount > 0 ||
      params.grainSize > 0 ||
      (params.innerGlowOpacity > 0 && params.innerGlowSize > 0)
    );
  }

  return (
    (params.innerGlowOpacity > 0 && params.innerGlowSize > 0) ||
    params.textureIntensity > 0 ||
    params.textureThreshold > 0 ||
    params.tornEdgeStrength > 0 ||
    params.tornEdgeDetail > 0 ||
    params.textureInvert
  );
};

export const renderEffect = (effectId: EffectId, input: RenderInput): void => {
  if (!input.patternImage) {
    const ctx = input.canvas.getContext('2d');
    ctx?.clearRect(0, 0, input.canvas.width, input.canvas.height);
    return;
  }

  if (!hasActiveEffect(effectId, input)) {
    drawOriginalImage(input);
    return;
  }

  if (effectId === 'roughEngraving') {
    renderRoughEngraving(input);
    return;
  }

  renderTornTextureEngraving(input);
};
