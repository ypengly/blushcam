'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DocPreview } from './DocPreview.tsx';
import { AUDIENCES, KINDS, TEMPLATES } from '../lib/templatesCatalog.ts';
import type { Audience, TemplateKind } from '../lib/templatesCatalog.ts';

export function TemplateBrowser({ limit }: { limit?: number }) {
  const [kind, setKind] = useState<TemplateKind | 'all'>('all');
  const [aud, setAud] = useState<Audience | 'all'>('all');
  const list = useMemo(() => TEMPLATES.filter((t) => (kind === 'all' || t.kind === kind) && (aud === 'all' || t.audience === aud || t.audience === 'everyone')).slice(0, limit ?? 999), [kind, aud, limit]);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Template type">{KINDS.map((k) => <button key={k.id} className="chip" aria-pressed={kind === k.id} onClick={() => setKind(k.id)}>{k.label}</button>)}</div>
      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Who is it for">{AUDIENCES.map((a) => <button key={a.id} className="chip" aria-pressed={aud === a.id} onClick={() => setAud(a.id)}>{a.label}</button>)}</div>
      {list.length === 0 ? <p className="card text-center text-muted">No templates match yet — try another filter.</p> : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((t) => (
            <li key={t.id}>
              <Link href={t.href} className="group block rounded-xl2 border border-blush/50 bg-surface p-3 shadow-card transition hover:-translate-y-1 hover:shadow-soft">
                <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-xl bg-soft/60"><DocPreview doc={t.build()} className="h-full w-full" label={`${t.name} preview`} /></div>
                <p className="mt-2 text-sm font-bold">{t.name}</p>
                <p className="text-xs capitalize text-muted">{t.kind} · {t.audience === 'everyone' ? 'for anyone' : t.audience}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
