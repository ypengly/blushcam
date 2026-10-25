export type FilterCategory = 'natural' | 'coquette' | 'y2k' | 'vintage' | 'dreamy' | 'romantic' | 'celestial';

/** Every field is optional in presets; missing fields fall back to NEUTRAL. */
export interface FilterParams {
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  temperature: number; // -100 (cool) .. 100 (warm)
  tint: number; // -100 (green) .. 100 (magenta)
  fade: number; // 0..100 lifts blacks
  vignette: number; // 0..100
  grain: number; // 0..100
  blur: number; // 0..20 px radius at 1000px width (softens the whole image)
  glow: number; // 0..100 screen-blended blurred copy
  lightLeak: number; // 0..100
  leakColor: [number, number, number];
  tone: [number, number, number]; // rgb colour wash
  toneAmount: number; // 0..100
}

export interface FilterPreset {
  id: string;
  category: FilterCategory;
  name: string;
  params: Partial<FilterParams>;
  /** CSS filter string used only for cheap thumbnails; exports always use the pixel engine. */
  thumbCss: string;
  effects: Array<'color' | 'fade' | 'vignette' | 'grain' | 'blur' | 'glow' | 'lightLeak' | 'tone'>;
}

export interface FilterState {
  presetId: string | null;
  strength: number; // 0..100
  /** Manual adjustments layered on top of the preset (additive, same ranges). */
  adjust: Partial<Pick<FilterParams, 'brightness' | 'contrast' | 'saturation' | 'temperature' | 'tint' | 'blur' | 'vignette' | 'grain'>>;
  lightLeak: number; // 0..100 manual overlay amount
  grainOverlay: number; // 0..100 manual
}
