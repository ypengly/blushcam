import type { FilterCategory, FilterParams, FilterPreset, FilterState } from './types.ts';

export const NEUTRAL: FilterParams = {
  brightness: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0,
  fade: 0, vignette: 0, grain: 0, blur: 0, glow: 0,
  lightLeak: 0, leakColor: [255, 170, 120], tone: [255, 255, 255], toneAmount: 0,
};

function effectsOf(p: Partial<FilterParams>): FilterPreset['effects'] {
  const e: FilterPreset['effects'] = [];
  if (p.brightness || p.contrast || p.saturation || p.temperature || p.tint) e.push('color');
  if (p.fade) e.push('fade');
  if (p.vignette) e.push('vignette');
  if (p.grain) e.push('grain');
  if (p.blur) e.push('blur');
  if (p.glow) e.push('glow');
  if (p.lightLeak) e.push('lightLeak');
  if (p.toneAmount) e.push('tone');
  return e;
}

function css(p: Partial<FilterParams>): string {
  const b = 100 + (p.brightness ?? 0) * 0.6;
  const c = 100 + (p.contrast ?? 0) * 0.8;
  const s = 100 + (p.saturation ?? 0);
  const sepia = Math.max(0, (p.temperature ?? 0)) * 0.4;
  return `brightness(${b}%) contrast(${c}%) saturate(${s}%) sepia(${sepia}%)`;
}

function p(category: FilterCategory, id: string, name: string, params: Partial<FilterParams>): FilterPreset {
  return { id, category, name, params, thumbCss: css(params), effects: effectsOf(params) };
}

export const FILTER_CATEGORIES: Array<{ id: FilterCategory; label: string }> = [
  { id: 'natural', label: 'Natural' }, { id: 'coquette', label: 'Coquette' }, { id: 'y2k', label: 'Y2K' },
  { id: 'vintage', label: 'Vintage' }, { id: 'dreamy', label: 'Dreamy' }, { id: 'romantic', label: 'Romantic' },
  { id: 'celestial', label: 'Celestial' },
];

export const FILTER_PRESETS: FilterPreset[] = [
  // Natural
  p('natural', 'soft-skin', 'Soft Skin', { brightness: 6, contrast: -8, saturation: -4, temperature: 6, blur: 1.2, glow: 14 }),
  p('natural', 'warm-glow', 'Warm Glow', { brightness: 5, contrast: 4, saturation: 8, temperature: 28, glow: 10 }),
  p('natural', 'natural-light', 'Natural Light', { brightness: 8, contrast: 6, saturation: 4, temperature: 4 }),
  p('natural', 'fresh', 'Fresh', { brightness: 6, contrast: 8, saturation: 14, temperature: -10, tint: -4 }),
  p('natural', 'gentle-contrast', 'Gentle Contrast', { contrast: 16, saturation: 4, vignette: 10 }),
  // Coquette
  p('coquette', 'rosy-pink', 'Rosy Pink', { brightness: 6, saturation: 6, temperature: 8, tint: 22, tone: [248, 150, 190], toneAmount: 14, glow: 10 }),
  p('coquette', 'blush', 'Blush', { brightness: 8, contrast: -6, saturation: -2, tint: 16, tone: [250, 187, 208], toneAmount: 18, fade: 8 }),
  p('coquette', 'soft-peach', 'Soft Peach', { brightness: 7, contrast: -4, temperature: 22, tint: 8, tone: [255, 205, 170], toneAmount: 16, fade: 6 }),
  p('coquette', 'cherry-blossom', 'Cherry Blossom', { brightness: 9, contrast: -8, saturation: -6, tint: 18, tone: [252, 200, 220], toneAmount: 22, glow: 18, blur: 0.8 }),
  p('coquette', 'pink-dream', 'Pink Dream', { brightness: 10, contrast: -10, saturation: 4, tint: 26, tone: [245, 160, 205], toneAmount: 26, glow: 26, blur: 1.4, fade: 8 }),
  // Y2K
  p('y2k', 'digital-flash', 'Digital Flash', { brightness: 14, contrast: 22, saturation: -8, temperature: -8, vignette: 18, glow: 8 }),
  p('y2k', 'early-2000s', 'Early 2000s', { brightness: 6, contrast: 14, saturation: 12, temperature: 10, tint: 6, grain: 12, vignette: 12 }),
  p('y2k', 'cool-chrome', 'Cool Chrome', { brightness: 6, contrast: 24, saturation: -22, temperature: -26, tone: [190, 210, 235], toneAmount: 12 }),
  p('y2k', 'retro-digital', 'Retro Digital', { contrast: 10, saturation: 18, tint: 10, grain: 22, lightLeak: 18, leakColor: [255, 90, 150] }),
  p('y2k', 'party-flash', 'Party Flash', { brightness: 18, contrast: 26, saturation: 14, tint: 10, vignette: 30, glow: 12 }),
  // Vintage
  p('vintage', 'film-grain', 'Film Grain', { contrast: 8, saturation: -8, temperature: 6, grain: 42 }),
  p('vintage', 'disposable-camera', 'Disposable Camera', { brightness: 4, contrast: 14, saturation: 8, temperature: 14, grain: 34, vignette: 34, lightLeak: 22 }),
  p('vintage', 'faded-film', 'Faded Film', { brightness: 6, contrast: -14, saturation: -18, temperature: 8, fade: 26, grain: 20 }),
  p('vintage', 'warm-analog', 'Warm Analog', { contrast: 8, saturation: 6, temperature: 34, tint: 4, grain: 24, vignette: 20, fade: 10 }),
  p('vintage', 'retro-date', 'Retro Date', { contrast: 12, saturation: 4, temperature: 18, grain: 28, vignette: 22, lightLeak: 16, leakColor: [255, 140, 60] }),
  // Dreamy
  p('dreamy', 'fairy-glow', 'Fairy Glow', { brightness: 10, contrast: -12, saturation: 2, tint: 10, glow: 40, blur: 1.6, tone: [235, 225, 255], toneAmount: 12 }),
  p('dreamy', 'lavender-dream', 'Lavender Dream', { brightness: 8, contrast: -8, temperature: -12, tint: 22, tone: [215, 195, 250], toneAmount: 24, glow: 24, fade: 8 }),
  p('dreamy', 'soft-focus', 'Soft Focus', { brightness: 6, contrast: -10, blur: 3, glow: 30 }),
  p('dreamy', 'starlight', 'Starlight', { brightness: 4, contrast: -6, temperature: -10, glow: 36, blur: 1.2, tone: [210, 225, 255], toneAmount: 14, vignette: 14 }),
  p('dreamy', 'cloud-nine', 'Cloud Nine', { brightness: 14, contrast: -16, saturation: -8, glow: 38, blur: 2, fade: 14 }),
  // Romantic
  p('romantic', 'rose-tint', 'Rose Tint', { brightness: 4, contrast: 6, saturation: 6, tint: 18, tone: [240, 120, 150], toneAmount: 16, vignette: 14 }),
  p('romantic', 'golden-sunset', 'Golden Sunset', { brightness: 4, contrast: 10, saturation: 14, temperature: 40, tone: [255, 170, 90], toneAmount: 18, lightLeak: 20, leakColor: [255, 140, 60] }),
  p('romantic', 'love-letter', 'Love Letter', { contrast: 4, saturation: -10, temperature: 18, tone: [225, 190, 160], toneAmount: 22, fade: 14, grain: 14, vignette: 18 }),
  p('romantic', 'warm-memories', 'Warm Memories', { brightness: 6, contrast: -4, temperature: 30, fade: 12, glow: 14, grain: 12, vignette: 16 }),
  p('romantic', 'pastel-romance', 'Pastel Romance', { brightness: 10, contrast: -10, saturation: -4, tint: 14, tone: [250, 200, 215], toneAmount: 20, fade: 12, glow: 16 }),
  // Celestial
  p('celestial', 'moonlight', 'Moonlight', { brightness: -4, contrast: 10, saturation: -18, temperature: -30, tone: [150, 180, 255], toneAmount: 22, vignette: 32, glow: 10 }),
  p('celestial', 'violet-sky', 'Violet Sky', { brightness: -2, contrast: 12, saturation: 8, temperature: -18, tint: 28, tone: [170, 120, 235], toneAmount: 26, vignette: 26 }),
  p('celestial', 'silver-stars', 'Silver Stars', { brightness: 2, contrast: 14, saturation: -34, temperature: -14, tone: [215, 220, 235], toneAmount: 18, glow: 20, vignette: 20 }),
  p('celestial', 'cosmic-blue', 'Cosmic Blue', { brightness: -6, contrast: 16, saturation: 6, temperature: -36, tone: [90, 130, 245], toneAmount: 28, vignette: 36, glow: 12 }),
];

export const PRESET_BY_ID: Record<string, FilterPreset> = Object.fromEntries(FILTER_PRESETS.map((x) => [x.id, x]));

export const DEFAULT_FILTER_STATE: FilterState = { presetId: null, strength: 100, adjust: {}, lightLeak: 0, grainOverlay: 0 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Resolve a FilterState to final engine parameters. Strength scales preset params toward NEUTRAL. */
export function resolveParams(state: FilterState): FilterParams {
  const preset = state.presetId ? PRESET_BY_ID[state.presetId] : undefined;
  const k = clamp(state.strength, 0, 100) / 100;
  const base: FilterParams = { ...NEUTRAL };
  if (preset) {
    const pp = preset.params;
    for (const key of Object.keys(NEUTRAL) as Array<keyof FilterParams>) {
      const v = pp[key];
      if (v === undefined) continue;
      if (key === 'leakColor' || key === 'tone') (base as any)[key] = v;
      else (base as any)[key] = (v as number) * k;
    }
  }
  const a = state.adjust;
  base.brightness = clamp(base.brightness + (a.brightness ?? 0), -100, 100);
  base.contrast = clamp(base.contrast + (a.contrast ?? 0), -100, 100);
  base.saturation = clamp(base.saturation + (a.saturation ?? 0), -100, 100);
  base.temperature = clamp(base.temperature + (a.temperature ?? 0), -100, 100);
  base.tint = clamp(base.tint + (a.tint ?? 0), -100, 100);
  base.blur = clamp(base.blur + (a.blur ?? 0), 0, 20);
  base.vignette = clamp(base.vignette + (a.vignette ?? 0), 0, 100);
  base.grain = clamp(base.grain + (a.grain ?? 0) + state.grainOverlay, 0, 100);
  base.lightLeak = clamp(base.lightLeak + state.lightLeak, 0, 100);
  return base;
}

export function isNeutral(params: FilterParams): boolean {
  return (Object.keys(NEUTRAL) as Array<keyof FilterParams>).every((k) => {
    if (k === 'leakColor' || k === 'tone') return true;
    return params[k] === NEUTRAL[k];
  });
}
