/** All stickers are original vector art authored here (no third-party assets). viewBox is always 0 0 100 100. */
export interface StickerDef { id: string; collection: string; name: string; svg: (c: string) => string }

export const STICKER_COLLECTIONS = [
  { id: 'bows', label: 'Bows & ribbons' }, { id: 'hearts', label: 'Hearts' }, { id: 'flowers', label: 'Flowers' },
  { id: 'butterflies', label: 'Butterflies' }, { id: 'sparkles', label: 'Stars & sparkles' }, { id: 'clouds', label: 'Clouds' },
  { id: 'ears', label: 'Bunny & cat ears' }, { id: 'crowns', label: 'Crowns' }, { id: 'faces', label: 'Cute faces' },
  { id: 'letters', label: 'Love letters' }, { id: 'birthday', label: 'Birthday' }, { id: 'seasonal', label: 'Seasonal' },
] as const;

const wrap = (inner: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${inner}</svg>`;
const STROKE = '#352B35';
const heartPath = 'M50 88C20 64 8 46 8 32 8 20 17 12 28 12c9 0 17 5 22 13 5-8 13-13 22-13 11 0 20 8 20 20 0 14-12 32-42 56z';
const star = (cx: number, cy: number, R: number, r: number, n = 5) => {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) { const a = (Math.PI / n) * i - Math.PI / 2; const rad = i % 2 ? r : R; pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`); }
  return pts.join(' ');
};
const sparkle = (c: string, cx = 50, cy = 50, s = 40) => `<path d="M${cx} ${cy - s}Q${cx + 4} ${cy - 4} ${cx + s} ${cy}Q${cx + 4} ${cy + 4} ${cx} ${cy + s}Q${cx - 4} ${cy + 4} ${cx - s} ${cy}Q${cx - 4} ${cy - 4} ${cx} ${cy - s}z" fill="${c}"/>`;
const petals = (c: string, center: string, n = 6) => {
  let s = '';
  for (let i = 0; i < n; i++) s += `<ellipse cx="50" cy="26" rx="13" ry="20" fill="${c}" stroke="${STROKE}" stroke-opacity=".25" stroke-width="1.5" transform="rotate(${(360 / n) * i} 50 50)"/>`;
  return s + `<circle cx="50" cy="50" r="12" fill="${center}"/>`;
};
const bow = (c: string) => wrap(`<path d="M50 50C30 20 6 24 8 46c2 24 26 14 42 4z" fill="${c}"/><path d="M50 50C70 20 94 24 92 46c-2 24-26 14-42 4z" fill="${c}"/><path d="M50 52C40 66 30 86 24 92l12 4 14-30z" fill="${c}" opacity=".85"/><path d="M50 52C60 66 70 86 76 92l-12 4-14-30z" fill="${c}" opacity=".85"/><circle cx="50" cy="50" r="10" fill="${c}" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>`);
const butterfly = (c: string) => wrap(`<path d="M50 50C38 10 6 12 12 42c3 16 22 16 38 8z" fill="${c}"/><path d="M50 50C62 10 94 12 88 42c-3 16-22 16-38 8z" fill="${c}"/><path d="M50 52C34 56 20 62 26 80c6 14 22 4 24-28z" fill="${c}" opacity=".8"/><path d="M50 52C66 56 80 62 74 80c-6 14-22 4-24-28z" fill="${c}" opacity=".8"/><rect x="47" y="30" width="6" height="46" rx="3" fill="${STROKE}"/><path d="M48 30C44 18 38 14 34 14M52 30C56 18 62 14 66 14" stroke="${STROKE}" stroke-width="2" fill="none" stroke-linecap="round"/>`);
const cloud = (c: string) => wrap(`<path d="M26 74a18 18 0 0 1-2-36 24 24 0 0 1 46-4 20 20 0 0 1 6 40z" fill="${c}" stroke="${STROKE}" stroke-opacity=".18" stroke-width="2"/>`);
const bunnyEars = (c: string) => wrap(`<ellipse cx="32" cy="42" rx="13" ry="34" fill="${c}"/><ellipse cx="68" cy="42" rx="13" ry="34" fill="${c}" transform="rotate(8 68 42)"/><ellipse cx="32" cy="44" rx="6" ry="24" fill="#FCE4EC"/><ellipse cx="68" cy="44" rx="6" ry="24" fill="#FCE4EC" transform="rotate(8 68 44)"/>`);
const catEars = (c: string) => wrap(`<path d="M10 80L16 18 46 50z" fill="${c}"/><path d="M90 80L84 18 54 50z" fill="${c}"/><path d="M20 66L22 34 38 52z" fill="#FCE4EC"/><path d="M80 66L78 34 62 52z" fill="#FCE4EC"/>`);
const crown = (c: string) => wrap(`<path d="M12 78L8 30l24 22 18-30 18 30 24-22-4 48z" fill="${c}" stroke="${STROKE}" stroke-opacity=".3" stroke-width="2"/><circle cx="8" cy="28" r="5" fill="#fff"/><circle cx="50" cy="20" r="5" fill="#fff"/><circle cx="92" cy="28" r="5" fill="#fff"/><rect x="12" y="78" width="76" height="8" rx="3" fill="${c}" opacity=".8"/>`);
const smile = (c: string) => wrap(`<circle cx="50" cy="50" r="40" fill="${c}"/><circle cx="36" cy="44" r="5" fill="${STROKE}"/><circle cx="64" cy="44" r="5" fill="${STROKE}"/><path d="M34 60Q50 76 66 60" stroke="${STROKE}" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="26" cy="58" r="6" fill="#F48FB1" opacity=".6"/><circle cx="74" cy="58" r="6" fill="#F48FB1" opacity=".6"/>`);
const kawaii = (c: string) => wrap(`<ellipse cx="50" cy="54" rx="40" ry="34" fill="${c}"/><path d="M34 46Q38 40 42 46M58 46Q62 40 66 46" stroke="${STROKE}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M44 58Q50 64 56 58" stroke="${STROKE}" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="28" cy="58" r="5" fill="#F48FB1" opacity=".6"/><circle cx="72" cy="58" r="5" fill="#F48FB1" opacity=".6"/>`);
const envelope = (c: string) => wrap(`<rect x="10" y="22" width="80" height="58" rx="8" fill="#fff" stroke="${c}" stroke-width="4"/><path d="M12 28L50 56 88 28" stroke="${c}" stroke-width="4" fill="none" stroke-linejoin="round"/><path d="${heartPath}" fill="${c}" transform="translate(40 52) scale(.2)"/>`);
const balloon = (c: string) => wrap(`<ellipse cx="50" cy="40" rx="26" ry="32" fill="${c}"/><path d="M50 72l-5 8h10z" fill="${c}"/><path d="M50 80C44 88 56 92 50 98" stroke="${STROKE}" stroke-opacity=".5" stroke-width="2" fill="none"/><ellipse cx="40" cy="28" rx="6" ry="9" fill="#fff" opacity=".45"/>`);
const cake = (c: string) => wrap(`<rect x="18" y="52" width="64" height="32" rx="6" fill="${c}"/><path d="M18 62q8 8 16 0t16 0 16 0 16 0" fill="#fff"/><rect x="26" y="34" width="48" height="20" rx="5" fill="#FFF9F3" stroke="${c}" stroke-width="3"/><rect x="47" y="18" width="6" height="16" rx="2" fill="#E9DDFB"/><path d="M50 8q6 6 0 12-6-6 0-12z" fill="#FFB74D"/>`);
const partyHat = (c: string) => wrap(`<path d="M50 10L82 88H18z" fill="${c}"/><path d="M36 54h28M30 70h40" stroke="#fff" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round"/><circle cx="50" cy="10" r="7" fill="#fff"/>`);
const snowflake = (c: string) => wrap(`<g stroke="${c}" stroke-width="5" stroke-linecap="round">${[0, 60, 120].map((a) => `<g transform="rotate(${a} 50 50)"><path d="M50 8V92"/><path d="M40 20L50 30 60 20M40 80L50 70 60 80"/></g>`).join('')}</g>`);
const pumpkin = (c: string) => wrap(`<ellipse cx="50" cy="58" rx="40" ry="32" fill="${c}"/><ellipse cx="34" cy="58" rx="16" ry="30" fill="#000" opacity=".08"/><ellipse cx="66" cy="58" rx="16" ry="30" fill="#000" opacity=".08"/><rect x="46" y="18" width="8" height="16" rx="3" fill="#6D8F5E"/><path d="M32 52l8 10-12 0zM68 52l8 10-12 0zM36 74q14 10 28 0" fill="${STROKE}" stroke="${STROKE}" stroke-width="3" stroke-linejoin="round"/>`);
const sun = (c: string) => wrap(`<circle cx="50" cy="50" r="22" fill="${c}"/><g stroke="${c}" stroke-width="6" stroke-linecap="round">${Array.from({ length: 8 }, (_, i) => `<path d="M50 12V22" transform="rotate(${i * 45} 50 50)"/>`).join('')}</g>`);
const moon = (c: string) => wrap(`<path d="M64 12A40 40 0 1 0 88 66 32 32 0 0 1 64 12z" fill="${c}"/>`);
const leaf = (c: string) => wrap(`<path d="M16 84C10 40 40 12 88 12 90 60 62 90 16 84z" fill="${c}"/><path d="M16 84C36 60 54 42 78 22" stroke="#fff" stroke-opacity=".6" stroke-width="3" fill="none"/>`);

const defs: Array<[string, string, string, (c: string) => string]> = [
  ['bows', 'bow-classic', 'Classic bow', bow], ['bows', 'ribbon-heart', 'Ribbon bow', (c) => bow(c)],
  ['hearts', 'heart', 'Heart', (c) => wrap(`<path d="${heartPath}" fill="${c}"/><path d="M26 24c-6 2-10 8-10 14" stroke="#fff" stroke-opacity=".6" stroke-width="5" fill="none" stroke-linecap="round"/>`)],
  ['hearts', 'heart-outline', 'Heart outline', (c) => wrap(`<path d="${heartPath}" fill="none" stroke="${c}" stroke-width="7" stroke-linejoin="round"/>`)],
  ['hearts', 'heart-double', 'Two hearts', (c) => wrap(`<path d="${heartPath}" fill="${c}" transform="translate(0 14) scale(.62)"/><path d="${heartPath}" fill="${c}" opacity=".7" transform="translate(42 4) scale(.5)"/>`)],
  ['flowers', 'flower-daisy', 'Daisy', (c) => wrap(petals('#fff', c, 8))], ['flowers', 'flower-blossom', 'Blossom', (c) => wrap(petals(c, '#FFD54F', 5))],
  ['flowers', 'flower-tulip', 'Tulip', (c) => wrap(`<path d="M30 20l10 14 10-18 10 18 10-14c4 30-2 50-20 52-18-2-24-22-20-52z" fill="${c}"/><path d="M50 70V94" stroke="#7BA66F" stroke-width="6" stroke-linecap="round"/><path d="M50 84Q34 80 30 68Q44 70 50 84z" fill="#7BA66F"/>`)],
  ['butterflies', 'butterfly', 'Butterfly', butterfly], ['butterflies', 'butterfly-small', 'Little butterfly', (c) => butterfly(c)],
  ['sparkles', 'star', 'Star', (c) => wrap(`<polygon points="${star(50, 53, 44, 20)}" fill="${c}" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>`)],
  ['sparkles', 'sparkle', 'Sparkle', (c) => wrap(sparkle(c))],
  ['sparkles', 'sparkle-trio', 'Sparkle trio', (c) => wrap(sparkle(c, 40, 56, 32) + sparkle(c, 74, 26, 18) + sparkle(c, 78, 76, 14))],
  ['clouds', 'cloud', 'Cloud', (c) => cloud(c)], ['clouds', 'cloud-heart', 'Cloud & heart', (c) => wrap(cloud(c).replace(/<\/?svg[^>]*>/g, '') + `<path d="${heartPath}" fill="#F8BBD0" transform="translate(40 52) scale(.2)"/>`)],
  ['ears', 'bunny-ears', 'Bunny ears', bunnyEars], ['ears', 'cat-ears', 'Cat ears', catEars],
  ['crowns', 'crown', 'Crown', crown], ['crowns', 'tiara', 'Tiara', (c) => wrap(`<path d="M10 76Q50 40 90 76z" fill="${c}"/><circle cx="50" cy="46" r="8" fill="#fff"/><circle cx="28" cy="62" r="5" fill="#fff"/><circle cx="72" cy="62" r="5" fill="#fff"/>`)],
  ['faces', 'face-smile', 'Smiley', smile], ['faces', 'face-kawaii', 'Kawaii face', kawaii],
  ['letters', 'envelope', 'Love letter', envelope], ['letters', 'note-heart', 'Note', (c) => wrap(`<rect x="16" y="12" width="68" height="76" rx="6" fill="#fff" stroke="${c}" stroke-width="3"/><path d="M28 34h44M28 48h44M28 62h26" stroke="${c}" stroke-width="3" stroke-linecap="round" opacity=".7"/>`)],
  ['birthday', 'balloon', 'Balloon', balloon], ['birthday', 'cake', 'Cake', cake], ['birthday', 'party-hat', 'Party hat', partyHat],
  ['seasonal', 'snowflake', 'Snowflake', snowflake], ['seasonal', 'pumpkin', 'Pumpkin', pumpkin], ['seasonal', 'sun', 'Sun', sun],
  ['seasonal', 'moon', 'Moon', moon], ['seasonal', 'leaf', 'Leaf', leaf],
];

export const STICKERS: StickerDef[] = defs.map(([collection, id, name, svg]) => ({ id, collection, name, svg }));
export const STICKER_BY_ID: Record<string, StickerDef> = Object.fromEntries(STICKERS.map((s) => [s.id, s]));
export const DEFAULT_STICKER_COLOR = '#D96C93';

export function stickerSvg(id: string, color = DEFAULT_STICKER_COLOR): string | null {
  const def = STICKER_BY_ID[id];
  return def ? def.svg(color) : null;
}
export function stickerDataUrl(id: string, color?: string): string | null {
  const svg = stickerSvg(id, color);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
