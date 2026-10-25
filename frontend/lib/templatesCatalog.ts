import { BOOTH_THEMES, buildBoothDoc } from '../features/photo-booth/layouts.ts';
import { COLLAGE_LAYOUTS, buildCollageDoc } from '../features/collage/layouts.ts';
import type { CollageLayoutId } from '../features/collage/layouts.ts';
import { SCRAPBOOK_TEMPLATES, buildScrapbookPage } from '../features/scrapbook/templates.ts';
import type { Doc } from './editor/model.ts';

export type TemplateKind = 'booth' | 'collage' | 'scrapbook';
export type Audience = 'everyone' | 'solo' | 'friends' | 'couple' | 'family';
export interface TemplateEntry { id: string; kind: TemplateKind; name: string; audience: Audience; href: string; build: () => Doc }

const boothAudience: Record<string, Audience> = { 'best-friends': 'friends', 'couple-memories': 'couple', 'hearts-roses': 'couple', 'bunny-cat': 'friends', birthday: 'everyone', christmas: 'family', 'summer-vacation': 'everyone' };

export const TEMPLATES: TemplateEntry[] = [
  ...BOOTH_THEMES.map((t): TemplateEntry => ({ id: `booth-${t.id}`, kind: 'booth', name: t.name, audience: boothAudience[t.id] ?? 'everyone', href: `/booth?theme=${t.id}`, build: () => buildBoothDoc('four', t.id) })),
  ...SCRAPBOOK_TEMPLATES.map((t): TemplateEntry => ({ id: `scrap-${t.id}`, kind: 'scrapbook', name: t.name, audience: t.audience, href: `/scrapbook?template=${t.id}`, build: () => buildScrapbookPage(t.id) })),
  ...(Object.keys(COLLAGE_LAYOUTS) as CollageLayoutId[]).map((id): TemplateEntry => ({ id: `collage-${id}`, kind: 'collage', name: `${COLLAGE_LAYOUTS[id].label} collage`, audience: 'everyone', href: `/collage?layout=${id}`, build: () => buildCollageDoc(id, '4:5', []) })),
];

export const AUDIENCES: Array<{ id: Audience | 'all'; label: string }> = [
  { id: 'all', label: 'All' }, { id: 'solo', label: 'Solo' }, { id: 'friends', label: 'Friends' }, { id: 'couple', label: 'Couples' }, { id: 'family', label: 'Family' }, { id: 'everyone', label: 'Anyone' },
];
export const KINDS: Array<{ id: TemplateKind | 'all'; label: string }> = [{ id: 'all', label: 'Everything' }, { id: 'booth', label: 'Photo booth' }, { id: 'collage', label: 'Collage' }, { id: 'scrapbook', label: 'Scrapbook' }];
