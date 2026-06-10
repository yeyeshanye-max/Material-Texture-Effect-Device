export type EffectId = 'roughEngraving' | 'tornTextureEngraving';

export type ParameterKind = 'range' | 'toggle' | 'seed' | 'section' | 'info' | 'color' | 'select' | 'textureUpload';

export interface SectionParameter {
  key: string;
  label: string;
  kind: 'section';
}

export interface InfoParameter {
  key: string;
  label: string;
  kind: 'info';
}

export interface RangeParameter {
  key: keyof EffectParams;
  label: string;
  kind: 'range';
  min: number;
  max: number;
  step: number;
  unit?: string;
}

export interface ToggleParameter {
  key: keyof EffectParams;
  label: string;
  kind: 'toggle';
}

export interface SeedParameter {
  key: keyof EffectParams;
  label: string;
  kind: 'seed';
}

export interface ColorParameter {
  key: keyof EffectParams;
  label: string;
  kind: 'color';
}

export interface SelectParameter {
  key: keyof EffectParams;
  label: string;
  kind: 'select';
  options: Array<{ label: string; value: string }>;
}

export interface TextureUploadParameter {
  key: string;
  label: string;
  kind: 'textureUpload';
}

export type EffectParameter =
  | RangeParameter
  | ToggleParameter
  | SeedParameter
  | SectionParameter
  | InfoParameter
  | ColorParameter
  | SelectParameter
  | TextureUploadParameter;

export interface EffectConfig {
  id: EffectId;
  name: string;
  description: string;
  defaults: EffectParams;
  parameters: EffectParameter[];
}

export interface EffectParams {
  patternInvert: boolean;
  innerGlowIntensity: number;
  innerGlowRange: number;
  innerGlowEdgeRange: number;
  innerGlowCenter: boolean;
  innerGlowColor: string;
  innerGlowOpacity: number;
  innerGlowSize: number;
  innerGlowChoke: number;
  innerGlowSource: 'center' | 'edge';
  innerGlowRangeAmount: number;
  innerGlowCenterX: number;
  innerGlowCenterY: number;
  innerGlowGamma: number;
  innerGlowBlendMode: 'normal' | 'screen';
  contrast: number;
  randomSeed: number;
  roughness: number;
  roughSmoothing: number;
  roughRelative: boolean;
  roughSmoothPoints: boolean;
  lineDensity: number;
  coarseGrainAmount: number;
  lineAngle: number;
  grainSize: number;
  pathAmount: number;
  cornerAmount: number;
  traceFill: boolean;
  traceIgnoreWhite: boolean;
  textureIntensity: number;
  textureScale: number;
  textureInvert: boolean;
  textureThreshold: number;
  tornEdgeStrength: number;
  tornEdgeDetail: number;
}

export interface RenderInput {
  canvas: HTMLCanvasElement;
  patternImage: HTMLImageElement | null;
  textureImage: HTMLImageElement | null;
  params: EffectParams;
}
