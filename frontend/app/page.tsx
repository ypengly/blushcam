import Link from 'next/link';
import { Camera, Sparkles, LayoutGrid, BookHeart, Wand2, Shield, Image as ImageIcon, Users, Film } from 'lucide-react';
import { DocPreview } from '../components/DocPreview.tsx';
import { TemplateBrowser } from '../components/TemplateBrowser.tsx';
import { SiteFooter } from '../components/SiteFooter.tsx';
import { buildBoothDoc } from '../features/photo-booth/layouts.ts';
import { buildScrapbookPage } from '../features/scrapbook/templates.ts';

const features = [
  { icon: Camera, title: 'Live selfie camera', text: 'Real camera preview with timer, mirror and device switching.', href: '/camera' },
  { icon: Film, title: 'Korean four-cut booth', text: 'Auto-capture 1, 2, 4, 6 or 9 shots into a finished strip.', href: '/booth' },
  { icon: Sparkles, title: 'Y2K & vintage filters', text: '34 presets across 7 moods, with strength and fine-tuning.', href: '/filters' },
  { icon: ImageIcon, title: 'Stickers & frames', text: 'Original bows, hearts, flowers and more — drag, rotate, resize.', href: '/studio' },
  { icon: Wand2, title: 'AI enhancement', text: 'Honest, opt-in enhancement. Unavailable features say so.', href: '/ai-studio' },
  { icon: LayoutGrid, title: 'Photo collage', text: 'Ten layouts. Switch layouts without losing a photo.', href: '/collage' },
  { icon: BookHeart, title: 'Digital scrapbook', text: 'Multi-page journals with Polaroids, tape and doodles.', href: '/scrapbook' },
  { icon: Users, title: 'Couple & best-friend', text: 'Templates for friends, couples, family and solo moments.', href: '/templates' },
  { icon: Shield, title: 'Privacy-first', text: 'Editing happens in your browser. Uploads only when you choose.', href: '/privacy' },
];

export default function Home() {
  const strip = buildBoothDoc('four', 'coquette-pink', { date: '10.19.2026' });
  const strip2 = buildBoothDoc('four', 'y2k-silver');
  const page = buildScrapbookPage('best-friend-diary');
  return (
    <>
      <main>
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_70%_0%,rgb(var(--c-blush)/.55),transparent),radial-gradient(40rem_24rem_at_0%_30%,rgb(var(--c-lavender)/.7),transparent)]" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 lg:grid-cols-2 lg:py-24">
            <div>
              <p className="chip mb-4">✦ private · in-browser · free to start</p>
              <h1 className="font-display text-5xl font-bold leading-tight sm:text-6xl">Your Camera,<br /><span className="text-rose">Your Aesthetic.</span></h1>
              <p className="mt-4 max-w-md text-lg text-muted">Turn everyday moments into something beautiful.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/studio" className="btn-primary !px-7 !py-3 text-base">Start Creating</Link>
                <Link href="/templates" className="btn-soft !px-7 !py-3 text-base">Explore Styles</Link>
              </div>
            </div>
            <div className="relative mx-auto h-[28rem] w-full max-w-md" aria-hidden>
              <div className="float absolute left-0 top-6 w-40 rounded-xl bg-white p-1 shadow-soft" style={{ ['--r' as string]: '-6deg' }}><DocPreview doc={strip} className="w-full" /></div>
              <div className="float absolute right-2 top-0 w-44 rounded-xl bg-white p-1 shadow-soft" style={{ ['--r' as string]: '5deg', animationDelay: '1s' }}><DocPreview doc={strip2} className="w-full" /></div>
              <div className="float absolute bottom-0 left-16 w-64 rounded-xl bg-white p-1 shadow-soft" style={{ ['--r' as string]: '-2deg', animationDelay: '2s' }}><DocPreview doc={page} className="w-full" /></div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="features">
          <h2 id="features" className="font-display text-3xl">Everything in one cute studio</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: I, title, text, href }) => (
              <li key={title}><Link href={href} className="card block h-full transition hover:-translate-y-1 hover:shadow-soft"><span className="mb-3 inline-flex rounded-full bg-soft p-2.5 text-rose"><I size={20} /></span><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm text-muted">{text}</p></Link></li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-12" aria-labelledby="tpl">
          <div className="mb-6 flex items-end justify-between"><h2 id="tpl" className="font-display text-3xl">Pick a template</h2><Link href="/templates" className="text-sm font-semibold text-rose">See all →</Link></div>
          <TemplateBrowser limit={8} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
