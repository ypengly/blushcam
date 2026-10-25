import type { FilterParams } from './types.ts';
import { isNeutral } from './presets.ts';

const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

/** Deterministic PRNG so grain is identical between preview refreshes and exports. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Separable box blur (3 passes ≈ gaussian) on RGBA data. Returns a new array. */
export function boxBlur(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  const r = Math.round(radius);
  if (r < 1) return new Uint8ClampedArray(src);
  let a = new Uint8ClampedArray(src);
  let b = new Uint8ClampedArray(src.length);
  for (let pass = 0; pass < 3; pass++) {
    horizontal(a, b, w, h, r);
    vertical(b, a, w, h, r);
  }
  return a;
}

function horizontal(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number) {
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w * 4;
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[row + Math.min(w - 1, Math.max(0, i)) * 4 + c];
      for (let x = 0; x < w; x++) {
        dst[row + x * 4 + c] = sum / win;
        const add = Math.min(w - 1, x + r + 1);
        const rem = Math.max(0, x - r);
        sum += src[row + add * 4 + c] - src[row + rem * 4 + c];
      }
    }
  }
}

function vertical(src: Uint8ClampedArray, dst: Uint8ClampedArray, w: number, h: number, r: number) {
  const win = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let i = -r; i <= r; i++) sum += src[Math.min(h - 1, Math.max(0, i)) * w * 4 + x * 4 + c];
      for (let y = 0; y < h; y++) {
        dst[y * w * 4 + x * 4 + c] = sum / win;
        const add = Math.min(h - 1, y + r + 1);
        const rem = Math.max(0, y - r);
        sum += src[add * w * 4 + x * 4 + c] - src[rem * w * 4 + x * 4 + c];
      }
    }
  }
}

export interface ApplyOptions {
  /** Seed for grain. */
  seed?: number;
}

/**
 * Apply filter params to RGBA pixel data IN PLACE and return it.
 * Blur radius is specified relative to a 1000px-wide image so previews and full-res exports look alike.
 */
export function applyFilterToImageData(data: Uint8ClampedArray, w: number, h: number, params: FilterParams, opts: ApplyOptions = {}): Uint8ClampedArray {
  if (isNeutral(params)) return data;
  const scale = w / 1000;

  // 1. Softening / glow need a blurred copy of the ORIGINAL pixels.
  let blurred: Uint8ClampedArray | null = null;
  const blurPx = params.blur * scale;
  const glowRadius = Math.max(2, 14 * scale);
  if (params.glow > 0) blurred = boxBlur(data, w, h, glowRadius);
  if (blurPx >= 0.5) {
    const soft = boxBlur(data, w, h, blurPx);
    data.set(soft);
  }

  const bri = params.brightness * 2.55;
  const con = params.contrast / 100;
  const conFactor = con >= 0 ? 1 + con * 1.2 : 1 + con * 0.8;
  const sat = 1 + params.saturation / 100;
  const tempR = params.temperature * 0.6;
  const tempB = -params.temperature * 0.6;
  const tintG = -params.tint * 0.5;
  const tintRB = params.tint * 0.2;
  const fade = (params.fade / 100) * 60;
  const glowK = params.glow / 100;
  const toneK = params.toneAmount / 100;
  const [tr, tg, tb] = params.tone;
  const rand = mulberry32(opts.seed ?? 1337);
  const grainAmp = (params.grain / 100) * 48;
  const vig = params.vignette / 100;
  const leak = params.lightLeak / 100;
  const [lr, lg, lb] = params.leakColor;
  const cx = w / 2;
  const cy = h / 2;
  const maxD = Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let r = data[i], g = data[i + 1], b = data[i + 2];

      // glow: screen blend with blurred copy
      if (blurred && glowK > 0) {
        const br = blurred[i], bg = blurred[i + 1], bb = blurred[i + 2];
        r = 255 - ((255 - r) * (255 - br * glowK)) / 255;
        g = 255 - ((255 - g) * (255 - bg * glowK)) / 255;
        b = 255 - ((255 - b) * (255 - bb * glowK)) / 255;
      }

      // white balance
      r += tempR + tintRB; g += tintG; b += tempB + tintRB;

      // brightness + contrast around mid-grey
      r = (r + bri - 128) * conFactor + 128;
      g = (g + bri - 128) * conFactor + 128;
      b = (b + bri - 128) * conFactor + 128;

      // saturation
      if (sat !== 1) {
        const l = 0.299 * r + 0.587 * g + 0.114 * b;
        r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat;
      }

      // colour wash
      if (toneK > 0) {
        r += (tr - r) * toneK * 0.5; g += (tg - g) * toneK * 0.5; b += (tb - b) * toneK * 0.5;
      }

      // fade: lift blacks
      if (fade > 0) {
        r = r * (1 - fade / 255) + fade; g = g * (1 - fade / 255) + fade; b = b * (1 - fade / 255) + fade;
      }

      // light leak: warm gradient from top-right
      if (leak > 0) {
        const d = Math.sqrt((x - w) * (x - w) + y * y) / maxD; // 0 at corner
        const f = Math.max(0, 1 - d * 1.15) * leak * 0.75;
        r += lr * f; g += lg * f; b += lb * f;
      }

      // vignette
      if (vig > 0) {
        const d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / maxD;
        const f = 1 - vig * Math.max(0, d - 0.35) * 1.5;
        r *= f; g *= f; b *= f;
      }

      // grain (luma noise)
      if (grainAmp > 0) {
        const n = (rand() - 0.5) * grainAmp;
        r += n; g += n; b += n;
      }

      data[i] = clamp255(r); data[i + 1] = clamp255(g); data[i + 2] = clamp255(b);
    }
  }
  return data;
}
