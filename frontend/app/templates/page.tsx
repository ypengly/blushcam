import type { Metadata } from 'next';
import { TemplateBrowser } from '../../components/TemplateBrowser.tsx';
import { SiteFooter } from '../../components/SiteFooter.tsx';
export const metadata: Metadata = { title: 'Templates' };
export default function Templates() {
  return (<><main className="mx-auto max-w-7xl px-4 py-8"><h1 className="font-display text-3xl">Templates</h1><p className="mb-6 mt-1 text-muted">Solo, friends, couples and family — pick a style and it opens in the right editor. No account needed.</p><TemplateBrowser /></main><SiteFooter /></>);
}
