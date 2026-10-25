import Link from 'next/link';
import { Heart } from 'lucide-react';

const social = [
  { label: 'Instagram', url: process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM }, { label: 'TikTok', url: process.env.NEXT_PUBLIC_SOCIAL_TIKTOK }, { label: 'X', url: process.env.NEXT_PUBLIC_SOCIAL_X },
].filter((s) => !!s.url);
const email = process.env.NEXT_PUBLIC_CONTACT_EMAIL;

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-blush/40 bg-soft/50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="flex items-center gap-1.5 font-display text-xl text-rose"><Heart size={18} fill="currentColor" /> BlushCam</p><p className="mt-2 text-sm text-muted">Your camera, your aesthetic. Edit privately in your browser.</p></div>
        <nav aria-label="Product"><h2 className="mb-2 text-sm font-bold">Product</h2><ul className="space-y-1 text-sm text-muted">{[['Studio', '/studio'], ['Photo Booth', '/booth'], ['Filters', '/filters'], ['Collage', '/collage'], ['Scrapbook', '/scrapbook'], ['AI Studio', '/ai-studio']].map(([l, h]) => <li key={h}><Link className="hover:text-rose" href={h}>{l}</Link></li>)}</ul></nav>
        <nav aria-label="Company"><h2 className="mb-2 text-sm font-bold">Company</h2><ul className="space-y-1 text-sm text-muted"><li><Link className="hover:text-rose" href="/privacy">Privacy</Link></li><li><Link className="hover:text-rose" href="/terms">Terms</Link></li><li><Link className="hover:text-rose" href="/templates">Templates</Link></li>{email && <li><a className="hover:text-rose" href={`mailto:${email}`}>{email}</a></li>}</ul></nav>
        <div><h2 className="mb-2 text-sm font-bold">Follow</h2>{social.length ? <ul className="space-y-1 text-sm text-muted">{social.map((s) => <li key={s.label}><a className="hover:text-rose" href={s.url} rel="noopener noreferrer" target="_blank">{s.label}</a></li>)}</ul> : <p className="text-sm text-muted">Social links appear here once configured.</p>}</div>
      </div>
      <p className="border-t border-blush/30 py-4 text-center text-xs text-muted">© {new Date().getFullYear()} BlushCam</p>
    </footer>
  );
}
