export const clamp = (value: number, min = 0, max = 1): number => {
  return Math.min(max, Math.max(min, value));
};

export const smoothstep = (edge0: number, edge1: number, value: number): number => {
  const t = clamp((value - edge0) / (edge1 - edge0 || 1));
  return t * t * (3 - 2 * t);
};

export const contrastCurve = (value: number, contrast: number): number => {
  return clamp((value - 0.5) * contrast + 0.5);
};

export const seededNoise = (x: number, y: number, seed: number): number => {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
};

export const fractalNoise = (x: number, y: number, seed: number, detail: number): number => {
  const octaves = Math.max(2, Math.round(2 + detail * 5));
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  let weight = 0;

  for (let i = 0; i < octaves; i += 1) {
    total += seededNoise(Math.floor(x * frequency), Math.floor(y * frequency), seed + i * 19) * amplitude;
    weight += amplitude;
    amplitude *= 0.55;
    frequency *= 1.85;
  }

  return total / weight;
};
