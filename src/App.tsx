import { ChangeEvent, DragEvent, useCallback, useEffect, useRef, useState } from 'react';
import { effectConfigs, getDefaultParams } from './config/effectConfig';
import { renderEffect } from './effects';
import type { EffectId, EffectParams } from './types/effects';

interface UploadedImage {
  image: HTMLImageElement;
  name: string;
  url: string;
}

interface TexturePreset {
  id: string;
  name: string;
  defaults?: Partial<Pick<EffectParams, 'textureIntensity' | 'textureInvert' | 'textureThreshold'>>;
  url: string;
}

interface SavedPreset {
  id: string;
  name: string;
  effectId: EffectId;
  params: EffectParams;
}

const presetStorageKey = 'material-texture-effect-presets';
const acceptedPatternTypes = 'image/png,image/jpeg,.png,.jpg,.jpeg';
const acceptedTextureTypes = 'image/png,image/jpeg,.png,.jpg,.jpeg';
const assetBaseUrl = import.meta.env.BASE_URL;
const texturePresets: TexturePreset[] = [
  { defaults: { textureIntensity: 0.65, textureInvert: false, textureThreshold: 0.48 }, id: 'cloth', name: '布面纹理', url: `${assetBaseUrl}textures/cloth-texture.jpg` },
  { defaults: { textureIntensity: 0.72, textureInvert: true, textureThreshold: 0.38 }, id: 'scratch', name: '划痕纹理', url: `${assetBaseUrl}textures/scratch-texture.jpg` },
  { defaults: { textureIntensity: 0.75, textureInvert: true, textureThreshold: 0.5 }, id: 'halftone', name: '复古半调', url: `${assetBaseUrl}textures/retro-halftone.png` },
];

const revokeOwnedUrl = (url?: string): void => {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
};

const isSupportedPatternFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return file.type === 'image/png' || file.type === 'image/jpeg' || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
};

const isSupportedTextureFile = (file: File): boolean => {
  const name = file.name.toLowerCase();
  return file.type === 'image/png' || file.type === 'image/jpeg' || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg');
};

const readImageFile = (file: File): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve({ image, name: file.name, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    image.src = url;
  });
};

const readImageUrl = (url: string, name: string): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve({ image, name, url });
    image.onerror = () => reject(new Error('预设纹理读取失败'));
    image.src = url;
  });
};

const createImageFromCanvas = (canvas: HTMLCanvasElement, name: string): Promise<UploadedImage> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('抠图生成失败'));
        return;
      }

      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve({ image, name, url });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('抠图图片读取失败'));
      };
      image.src = url;
    }, 'image/png');
  });
};

const createGrayscaleImage = async (source: UploadedImage): Promise<UploadedImage> => {
  const width = source.image.naturalWidth || source.image.width;
  const height = source.image.naturalHeight || source.image.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('无法创建黑白图像');
  }

  ctx.drawImage(source.image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(data[i] * 0.2126 + data[i + 1] * 0.7152 + data[i + 2] * 0.0722);
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
  return createImageFromCanvas(canvas, `${source.name.replace(/\.[^.]+$/, '')}-黑白.png`);
};

const autoCutoutImage = async (source: UploadedImage): Promise<UploadedImage> => {
  const naturalWidth = source.image.naturalWidth || source.image.width;
  const naturalHeight = source.image.naturalHeight || source.image.height;
  const longEdge = Math.max(naturalWidth, naturalHeight);
  const scale = longEdge > 2400 ? 2400 / longEdge : 1;
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('无法创建抠图画布');
  }

  ctx.drawImage(source.image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) {
      continue;
    }

    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const maxChannel = Math.max(r, g, b);
    const minChannel = Math.min(r, g, b);
    const saturation = maxChannel - minChannel;
    const brightness = (r + g + b) / 3;

    if (brightness >= 190 && saturation <= 72) {
      data[i + 3] = 0;
      continue;
    }

    if (maxChannel >= 228 && minChannel >= 172) {
      data[i + 3] = 0;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return createImageFromCanvas(canvas, `${source.name.replace(/\.[^.]+$/, '')}-抠图.png`);
};

const formatValue = (value: number, unit = '') => {
  if (Math.abs(value - Math.round(value)) < 0.001) {
    return `${Math.round(value)}${unit}`;
  }
  return `${value.toFixed(2)}${unit}`;
};

const loadSavedPresets = (): SavedPreset[] => {
  try {
    const raw = window.localStorage.getItem(presetStorageKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const getCanvasPixelSize = (
  rect: DOMRectReadOnly,
  image: HTMLImageElement | null,
): { width: number; height: number } => {
  const dpr = window.devicePixelRatio || 1;
  const previewLongEdge = Math.max(rect.width, rect.height) * dpr * 1.4;

  if (image) {
    const sourceWidth = image.naturalWidth || image.width || rect.width;
    const sourceHeight = image.naturalHeight || image.height || rect.height;
    const sourceLongEdge = Math.max(sourceWidth, sourceHeight);
    const targetLongEdge = Math.min(1800, Math.max(Math.min(sourceLongEdge, 1800), previewLongEdge, 900));
    const scale = targetLongEdge / sourceLongEdge;

    return {
      width: Math.max(1, Math.round(sourceWidth * scale)),
      height: Math.max(1, Math.round(sourceHeight * scale)),
    };
  }

  const aspect = rect.width / Math.max(1, rect.height);
  const targetLongEdge = Math.min(1600, Math.max(previewLongEdge, 900));

  if (aspect >= 1) {
    return {
      width: Math.round(targetLongEdge),
      height: Math.round(targetLongEdge / aspect),
    };
  }

  return {
    width: Math.round(targetLongEdge * aspect),
    height: Math.round(targetLongEdge),
  };
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const [effectId, setEffectId] = useState<EffectId>('roughEngraving');
  const [params, setParams] = useState<EffectParams>(() => getDefaultParams('roughEngraving'));
  const [patternSource, setPatternSource] = useState<UploadedImage | null>(null);
  const [pattern, setPattern] = useState<UploadedImage | null>(null);
  const [texture, setTexture] = useState<UploadedImage | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 900, height: 680 });
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 900, height: 680 });
  const [isDraggingPattern, setIsDraggingPattern] = useState(false);
  const [isCuttingOut, setIsCuttingOut] = useState(false);
  const [isPatternGrayscale, setIsPatternGrayscale] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>(loadSavedPresets);
  const activeConfig = effectConfigs[effectId];

  useEffect(() => {
    return () => {
      revokeOwnedUrl(patternSource?.url);
      revokeOwnedUrl(pattern?.url);
      revokeOwnedUrl(texture?.url);
    };
  }, [pattern?.url, patternSource?.url, texture?.url]);

  useEffect(() => {
    let isCancelled = false;

    const updatePattern = async () => {
      if (!patternSource) {
        setPattern(null);
        return;
      }

      const nextPattern = isPatternGrayscale ? await createGrayscaleImage(patternSource) : patternSource;
      if (isCancelled) {
        if (nextPattern !== patternSource) {
          revokeOwnedUrl(nextPattern.url);
        }
        return;
      }

      setPattern((previous) => {
        if (previous !== patternSource) {
          revokeOwnedUrl(previous?.url);
        }
        return nextPattern;
      });
    };

    void updatePattern();

    return () => {
      isCancelled = true;
    };
  }, [isPatternGrayscale, patternSource]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const updateSize = () => {
      const rect = stage.getBoundingClientRect();
      const pixelSize = getCanvasPixelSize(rect, pattern?.image ?? null);
      const availableWidth = Math.max(1, rect.width - 56);
      const availableHeight = Math.max(1, rect.height - 56);
      const fitScale = Math.min(availableWidth / pixelSize.width, availableHeight / pixelSize.height, 1) * 0.82;

      setCanvasSize(pixelSize);
      setCanvasDisplaySize({
        width: Math.max(1, Math.round(pixelSize.width * fitScale)),
        height: Math.max(1, Math.round(pixelSize.height * fitScale)),
      });
    };

    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    updateSize();
    return () => observer.disconnect();
  }, [pattern?.image]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    if (renderFrameRef.current !== null) {
      window.cancelAnimationFrame(renderFrameRef.current);
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      canvas.width = canvasSize.width;
      canvas.height = canvasSize.height;
      renderEffect(effectId, {
        canvas,
        patternImage: pattern?.image ?? null,
        textureImage: texture?.image ?? null,
        params,
      });
      renderFrameRef.current = null;
    });

    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, [canvasSize, effectId, params, pattern, texture]);

  const setPatternImage = useCallback(async (file: File) => {
    const nextImage = await readImageFile(file);
    setPatternSource((previous) => {
      revokeOwnedUrl(previous?.url);
      return nextImage;
    });
  }, []);

  const uploadPattern = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isSupportedPatternFile(file)) {
      return;
    }
    await setPatternImage(file);
    event.target.value = '';
  }, [setPatternImage]);

  const uploadTexture = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isSupportedTextureFile(file)) {
      return;
    }
    const nextImage = await readImageFile(file);
    setTexture((previous) => {
      revokeOwnedUrl(previous?.url);
      return nextImage;
    });
    event.target.value = '';
  }, []);

  const selectTexturePreset = useCallback(async (preset: TexturePreset) => {
    const nextImage = await readImageUrl(preset.url, preset.name);
    setTexture((previous) => {
      revokeOwnedUrl(previous?.url);
      return nextImage;
    });
    if (preset.defaults) {
      setParams((current) => ({
        ...current,
        ...preset.defaults,
      }));
    }
  }, []);

  const cutoutPattern = useCallback(async () => {
    if (!pattern || isCuttingOut) {
      return;
    }

    setIsCuttingOut(true);
    try {
      const cutout = await autoCutoutImage(pattern);
      setPatternSource((previous) => {
        revokeOwnedUrl(previous?.url);
        return cutout;
      });
    } finally {
      setIsCuttingOut(false);
    }
  }, [isCuttingOut, pattern]);

  const updateParam = <K extends keyof EffectParams>(key: K, value: EffectParams[K]) => {
    setParams((current) => ({ ...current, [key]: value }));
  };

  const reseed = () => {
    setParams((current) => ({ ...current, randomSeed: Math.floor(Math.random() * 10000) }));
  };

  const clearEffect = () => {
    setParams(getDefaultParams(effectId));
  };

  const persistPresets = (nextPresets: SavedPreset[]) => {
    setSavedPresets(nextPresets);
    window.localStorage.setItem(presetStorageKey, JSON.stringify(nextPresets));
  };

  const savePreset = () => {
    const name = presetName.trim() || `${activeConfig.name} 预设 ${savedPresets.length + 1}`;
    const nextPreset: SavedPreset = {
      id: `${Date.now()}`,
      name,
      effectId,
      params: { ...params },
    };

    persistPresets([nextPreset, ...savedPresets]);
    setPresetName('');
  };

  const loadPreset = (presetId: string) => {
    const preset = savedPresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setEffectId(preset.effectId);
    setParams({ ...preset.params });
  };

  const deletePreset = (presetId: string) => {
    persistPresets(savedPresets.filter((item) => item.id !== presetId));
  };

  const handlePatternDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingPattern(false);
    const file = Array.from(event.dataTransfer.files).find(isSupportedPatternFile);
    if (file) {
      await setPatternImage(file);
    }
  };

  const exportPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const link = document.createElement('a');
    link.download = `${effectConfigs[effectId].name}-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <main className="app-shell">
      <aside className="left-panel panel">
        <div className="brand-block">
          <p className="eyebrow">Canvas Tool</p>
          <h1>材质肌理效果器</h1>
        </div>

        <section className="control-group">
          <h2>素材</h2>
          <label className="upload-box">
            <input accept={acceptedPatternTypes} type="file" onChange={uploadPattern} />
            <span>上传图案</span>
            <strong>{pattern?.name ?? 'PNG / JPG'}</strong>
          </label>
          <label className="left-toggle-row">
            <span>黑白</span>
            <input
              checked={isPatternGrayscale}
              type="checkbox"
              onChange={(event) => setIsPatternGrayscale(event.target.checked)}
            />
          </label>
          <button className="cutout-button" type="button" disabled={!pattern || isCuttingOut} onClick={cutoutPattern}>
            {isCuttingOut ? '抠图中...' : '自动抠图'}
          </button>
        </section>

        <section className="control-group">
          <h2>效果</h2>
          <div className="effect-list">
            {(Object.keys(effectConfigs) as EffectId[]).map((id) => (
              <button
                className={id === effectId ? 'effect-option active' : 'effect-option'}
                key={id}
                type="button"
                onClick={() => setEffectId(id)}
              >
                <span>{effectConfigs[id].name}</span>
                <small>{effectConfigs[id].description}</small>
              </button>
            ))}
          </div>
        </section>
      </aside>

      <section className="preview-column">
        <header className="topbar">
          <div>
            <p className="eyebrow">{activeConfig.name}</p>
            <h2>实时预览</h2>
          </div>
          <button className="export-button" type="button" onClick={exportPng}>
            导出 PNG
          </button>
        </header>
        <div
          className={isDraggingPattern ? 'canvas-stage dragging' : 'canvas-stage'}
          ref={stageRef}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDraggingPattern(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDraggingPattern(false)}
          onDrop={handlePatternDrop}
        >
          <canvas
            ref={canvasRef}
            aria-label="材质肌理效果实时预览"
            style={{ width: `${canvasDisplaySize.width}px`, height: `${canvasDisplaySize.height}px` }}
          />
          {!pattern && <div className="empty-state">拖入原图或从左侧上传 PNG / JPG</div>}
        </div>
      </section>

      <aside className="right-panel panel">
        <div className="panel-title">
          <p className="eyebrow">Parameters</p>
          <h2>参数调节</h2>
        </div>

        <button className="clear-effect-button" type="button" onClick={clearEffect}>
          清除效果
        </button>

        <div className="preset-panel">
          <input
            placeholder="预设名称"
            type="text"
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
          />
          <button type="button" onClick={savePreset}>
            保存预设
          </button>
          {savedPresets.length > 0 && (
            <div className="preset-list">
              {savedPresets.map((preset) => (
                <div className="preset-row" key={preset.id}>
                  <button type="button" onClick={() => loadPreset(preset.id)}>
                    {preset.name}
                  </button>
                  <button type="button" onClick={() => deletePreset(preset.id)}>
                    删除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="parameter-list">
          {activeConfig.parameters.map((parameter) => {
            if (parameter.kind === 'section') {
              return (
                <div className="parameter-section" key={parameter.key}>
                  {parameter.label}
                </div>
              );
            }

            if (parameter.kind === 'info') {
              return (
                <div className="parameter-info" key={parameter.key}>
                  {parameter.label}
                </div>
              );
            }

            if (parameter.kind === 'textureUpload') {
              return (
                <div className="texture-picker" key={parameter.key}>
                  <div className="texture-preset-grid">
                    {texturePresets.map((preset) => (
                      <button
                        className={texture?.url === preset.url ? 'texture-preset active' : 'texture-preset'}
                        key={preset.id}
                        type="button"
                        onClick={() => void selectTexturePreset(preset)}
                      >
                        <img alt="" src={preset.url} />
                        <span>{preset.name}</span>
                      </button>
                    ))}
                  </div>
                  <label className="texture-upload-row">
                    <input accept={acceptedTextureTypes} type="file" onChange={uploadTexture} />
                    <span>{parameter.label}</span>
                    <strong>{texture?.name ?? '未上传时使用内置噪声'}</strong>
                  </label>
                </div>
              );
            }

            const value = params[parameter.key];
            if (parameter.kind === 'toggle') {
              return (
                <label className="toggle-row" key={parameter.key}>
                  <span>{parameter.label}</span>
                  <input
                    checked={Boolean(value)}
                    type="checkbox"
                    onChange={(event) => updateParam(parameter.key, event.target.checked as never)}
                  />
                </label>
              );
            }

            if (parameter.kind === 'seed') {
              return (
                <div className="seed-row" key={parameter.key}>
                  <span>{parameter.label}</span>
                  <button type="button" onClick={reseed}>
                    重新生成
                  </button>
                </div>
              );
            }

            if (parameter.kind === 'color') {
              return (
                <label className="color-row" key={parameter.key}>
                  <span>{parameter.label}</span>
                  <input
                    type="color"
                    value={String(value)}
                    onChange={(event) => updateParam(parameter.key, event.target.value as never)}
                  />
                </label>
              );
            }

            if (parameter.kind === 'select') {
              return (
                <label className="select-row" key={parameter.key}>
                  <span>{parameter.label}</span>
                  <select
                    value={String(value)}
                    onChange={(event) => updateParam(parameter.key, event.target.value as never)}
                  >
                    {parameter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            return (
              <label className="range-row" key={parameter.key}>
                <span>
                  {parameter.label}
                  <strong>{formatValue(Number(value), parameter.unit)}</strong>
                </span>
                <input
                  max={parameter.max}
                  min={parameter.min}
                  step={parameter.step}
                  type="range"
                  value={Number(value)}
                  onChange={(event) => updateParam(parameter.key, Number(event.target.value) as never)}
                />
              </label>
            );
          })}
        </div>
      </aside>
    </main>
  );
}
