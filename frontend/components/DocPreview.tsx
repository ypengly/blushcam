import { stickerDataUrl } from '../features/stickers/catalog.ts';
import type { Background, Doc } from '../lib/editor/model.ts';

const PALETTE = [['#F9C9D6', '#E9DDFB'], ['#FFE3C7', '#F8BBD0'], ['#CDEBDD', '#E9F7EE'], ['#D9D2F4', '#F6D5E5'], ['#FFD9E6', '#FFF1D6'], ['#BFE3F2', '#E4F3FA']];

function bgDefs(id: string, bg: Background) {
  if (bg.kind === 'gradient') {
    const a = (bg.angle * Math.PI) / 180;
    return <linearGradient id={id} x1={0.5 - Math.sin(a) / 2} y1={0.5 + Math.cos(a) / 2} x2={0.5 + Math.sin(a) / 2} y2={0.5 - Math.cos(a) / 2}><stop offset="0" stopColor={bg.from} /><stop offset="1" stopColor={bg.to} /></linearGradient>;
  }
  return null;
}
const bgFill = (id: string, bg: Background) => (bg.kind === 'solid' ? bg.color : bg.kind === 'gradient' ? `url(#${id})` : bg.kind === 'pattern' ? bg.base : 'transparent');

/** Lightweight vector rendering of a Doc (placeholders for photos) used for template cards and the hero — no remote images. */
export function DocPreview({ doc, className, label }: { doc: Doc; className?: string; label?: string }) {
  const uid = `bg${Math.abs(hash(JSON.stringify(doc.background) + doc.width))}`;
  let pi = 0;
  return (
    <svg viewBox={`0 0 ${doc.width} ${doc.height}`} className={className} role="img" aria-label={label ?? 'Template preview'} preserveAspectRatio="xMidYMid meet">
      <defs>{bgDefs(uid, doc.background)}{doc.layers.filter((l) => l.kind === 'photo').map((l, i) => { const [a, b] = PALETTE[i % PALETTE.length]; return <linearGradient key={l.id} id={`ph${uid}${i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={a} /><stop offset="1" stopColor={b} /></linearGradient>; })}</defs>
      <rect width={doc.width} height={doc.height} fill={bgFill(uid, doc.background)} />
      {doc.layers.map((l) => {
        const tf = `rotate(${l.rotation} ${l.x + l.w / 2} ${l.y + l.h / 2})`;
        if (l.kind === 'photo') {
          const i = pi++; const bw = l.border.width;
          return (
            <g key={l.id} transform={tf} opacity={l.opacity} style={l.shadow ? { filter: 'drop-shadow(0 6px 10px rgba(53,43,53,.22))' } : undefined}>
              {bw > 0 && <rect x={l.x} y={l.y} width={l.w} height={l.h} rx={l.radius} fill={l.border.color} />}
              <rect x={l.x + bw} y={l.y + bw} width={Math.max(1, l.w - bw * 2)} height={Math.max(1, l.h - bw * 2)} rx={Math.max(0, l.radius - bw)} fill={`url(#ph${uid}${i})`} />
              <circle cx={l.x + l.w * 0.5} cy={l.y + l.h * 0.42} r={Math.min(l.w, l.h) * 0.14} fill="#fff" opacity=".7" />
              <path d={`M${l.x + l.w * 0.28} ${l.y + l.h * 0.82}q${l.w * 0.22} ${-l.h * 0.28} ${l.w * 0.44} 0z`} fill="#fff" opacity=".6" />
            </g>
          );
        }
        if (l.kind === 'sticker') { const u = stickerDataUrl(l.stickerId, l.color); return u ? <image key={l.id} href={u} x={l.x} y={l.y} width={l.w} height={l.h} transform={tf} opacity={l.opacity} /> : null; }
        if (l.kind === 'text') return <text key={l.id} x={l.align === 'left' ? l.x : l.align === 'right' ? l.x + l.w : l.x + l.w / 2} y={l.y + l.fontSize} textAnchor={l.align === 'left' ? 'start' : l.align === 'right' ? 'end' : 'middle'} fontSize={l.fontSize} fontFamily={l.fontFamily} fontWeight={l.fontWeight} fill={l.color} opacity={l.opacity} transform={tf}>{l.text.split('\n')[0]}</text>;
        return <rect key={l.id} x={l.x} y={l.y} width={l.w} height={l.h} rx={l.radius || 3} fill={l.fill} opacity={l.opacity} transform={tf} />;
      })}
    </svg>
  );
}
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
