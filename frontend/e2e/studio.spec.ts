import { test, expect } from '@playwright/test';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';

/** Generates a small synthetic PNG fixture so no real photos are used. */
function fixturePng(file: string) {
  const w = 64, h = 64, raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; for (let x = 0; x < w; x++) { const i = y * (w * 4 + 1) + 1 + x * 4; raw[i] = 200; raw[i + 1] = 120 + x; raw[i + 2] = 140 + y; raw[i + 3] = 255; } }
  const crc = (b: Buffer) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const fx = path.join(__dirname, 'fixture.png');
test.beforeAll(() => fixturePng(fx));

test('landing → templates → open camera button visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Your Camera/ })).toBeVisible();
  await page.getByRole('link', { name: 'Explore Styles' }).click();
  await expect(page.getByRole('heading', { name: 'Templates' })).toBeVisible();
  await page.getByRole('button', { name: 'Photo booth' }).click();
  await page.getByRole('link', { name: /Coquette pink/ }).first().click();
  await expect(page).toHaveURL(/\/booth\?theme=coquette-pink/);
});

test('fake camera: capture, edit with filter + sticker + text, export PNG', async ({ page }) => {
  await page.goto('/camera');
  await page.getByRole('button', { name: /Allow camera/ }).click();
  await expect(page.getByText('Camera on')).toBeVisible();
  await page.getByRole('button', { name: /^Capture/ }).click();
  await page.getByRole('button', { name: 'Edit this photo' }).click();
  await expect(page.getByRole('navigation', { name: 'Tools' }).first()).toBeVisible();
  await page.getByRole('button', { name: /Rosy Pink/ }).click();
  await page.getByRole('button', { name: 'Stickers' }).first().click();
  await page.getByRole('button', { name: 'Add Heart sticker' }).click();
  await page.getByRole('button', { name: 'Text' }).first().click();
  await page.getByRole('button', { name: 'Add text' }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.getByRole('button', { name: /Export/ }).click(); await page.getByRole('button', { name: /Download PNG/ }).click(); })()]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  const f = await dl.path(); expect(fs.statSync(f!).size).toBeGreaterThan(1000);
});

test('booth with uploaded photos builds a strip and exports', async ({ page }) => {
  await page.goto('/booth');
  await page.getByRole('button', { name: 'Four-cut' }).click();
  await page.locator('input[type=file]').setInputFiles([fx, fx, fx, fx]);
  await page.getByRole('button', { name: /Make my strip/ }).click();
  const [dl] = await Promise.all([page.waitForEvent('download'), (async () => { await page.getByRole('button', { name: /Export/ }).click(); await page.getByRole('button', { name: /Download PNG/ }).click(); })()]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
});

test('collage keeps photos when switching layouts', async ({ page }) => {
  await page.goto('/collage');
  await page.getByRole('button', { name: 'Photos' }).first().click();
  await page.locator('input[type=file]').first().setInputFiles([fx, fx, fx]);
  await page.getByRole('button', { name: 'Layout' }).first().click();
  await page.getByRole('button', { name: 'Two photos' }).click();
  await expect(page.getByText(/extra photo/)).toBeVisible();
});

test('mobile nav opens', async ({ page, isMobile }) => {
  test.skip(!isMobile);
  await page.goto('/'); await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
});
