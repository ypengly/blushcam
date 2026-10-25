/** Tiny in-memory canvas double: real pixel buffers for offscreen drawImage/get/putImageData, recorded calls for the rest. */
export interface RawImage { width: number; height: number; data: Uint8ClampedArray }

export function solidImage(w: number, h: number, rgb: [number, number, number]): RawImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = rgb[0]; data[i * 4 + 1] = rgb[1]; data[i * 4 + 2] = rgb[2]; data[i * 4 + 3] = 255; }
  return { width: w, height: h, data };
}

export class FakeCanvas {
  width: number; height: number; data: Uint8ClampedArray; calls: Array<{ fn: string; args: unknown[] }> = [];
  constructor(w: number, h: number) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); }
  getContext() { return new FakeCtx(this) as any; }
}

export class FakeCtx {
  canvas: FakeCanvas; font = ''; fillStyle: any = ''; strokeStyle: any = ''; globalAlpha = 1; lineWidth = 1; textAlign = 'left'; textBaseline = 'alphabetic';
  shadowColor = ''; shadowBlur = 0; shadowOffsetY = 0;
  constructor(c: FakeCanvas) { this.canvas = c; }
  private rec(fn: string, ...args: unknown[]) { this.canvas.calls.push({ fn, args }); }
  save() { this.rec('save'); } restore() { this.rec('restore'); } translate(...a: number[]) { this.rec('translate', ...a); }
  rotate(...a: number[]) { this.rec('rotate', ...a); } scale(...a: number[]) { this.rec('scale', ...a); } setTransform() { this.rec('setTransform'); }
  beginPath() {} closePath() {} moveTo() {} lineTo() {} arcTo() {} rect() {} arc() {} clip() { this.rec('clip'); } stroke() { this.rec('stroke'); } setLineDash() {}
  fill() { this.rec('fill', this.fillStyle); }
  clearRect() { this.canvas.data.fill(0); }
  fillRect(x: number, y: number, w: number, h: number) {
    this.rec('fillRect', x, y, w, h, this.fillStyle);
    const m = /^#([0-9a-f]{6})$/i.exec(String(this.fillStyle));
    if (!m) return;
    const n = parseInt(m[1], 16); const c = this.canvas;
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(c.height, y + h); yy++) for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(c.width, x + w); xx++) {
      const i = (yy * c.width + xx) * 4; c.data[i] = (n >> 16) & 255; c.data[i + 1] = (n >> 8) & 255; c.data[i + 2] = n & 255; c.data[i + 3] = 255;
    }
  }
  createLinearGradient() { return { addColorStop() {} }; }
  measureText(s: string) { return { width: s.length * 10 }; }
  fillText(...a: unknown[]) { this.rec('fillText', ...a); }
  getImageData(x: number, y: number, w: number, h: number) {
    const out = new Uint8ClampedArray(w * h * 4); const c = this.canvas;
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) for (let k = 0; k < 4; k++) out[(yy * w + xx) * 4 + k] = c.data[((y + yy) * c.width + (x + xx)) * 4 + k];
    return { data: out, width: w, height: h };
  }
  putImageData(img: { data: Uint8ClampedArray; width: number; height: number }, x: number, y: number) {
    const c = this.canvas;
    for (let yy = 0; yy < img.height; yy++) for (let xx = 0; xx < img.width; xx++) for (let k = 0; k < 4; k++) c.data[((y + yy) * c.width + (x + xx)) * 4 + k] = img.data[(yy * img.width + xx) * 4 + k];
  }
  drawImage(src: any, ...a: number[]) {
    this.rec('drawImage', src, ...a);
    const c = this.canvas;
    if (a.length === 8) { // source rect -> dest rect (nearest neighbour), only used for the offscreen photo canvas
      const [sx, sy, sw, sh, dx, dy, dw, dh] = a;
      for (let yy = 0; yy < dh; yy++) for (let xx = 0; xx < dw; xx++) {
        const px = Math.min(src.width - 1, Math.floor(sx + (xx / dw) * sw)), py = Math.min(src.height - 1, Math.floor(sy + (yy / dh) * sh));
        for (let k = 0; k < 4; k++) c.data[((dy + yy) * c.width + (dx + xx)) * 4 + k] = src.data[(py * src.width + px) * 4 + k];
      }
    }
  }
}

export const createCanvas = (w: number, h: number) => new FakeCanvas(w, h) as any;
