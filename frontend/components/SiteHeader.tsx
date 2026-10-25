'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, Heart, Menu, X } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle.tsx';
import { useUser } from '../hooks/useUser.ts';

export const NAV = [
  { href: '/studio', label: 'Studio' }, { href: '/booth', label: 'Photo Booth' }, { href: '/filters', label: 'Filters' },
  { href: '/collage', label: 'Collage' }, { href: '/templates', label: 'Templates' }, { href: '/gallery', label: 'My Gallery' },
];

export function SiteHeader() {
  const path = usePathname(); const [open, setOpen] = useState(false); const { user } = useUser();
  useEffect(() => setOpen(false), [path]);
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-blush/40 bg-cream/90 backdrop-blur">
      <a href="#main" className="sr-only-focusable absolute left-2 top-2 rounded bg-rose px-3 py-1 text-white">Skip to content</a>
      <div className="mx-auto flex h-full max-w-7xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-1.5 font-display text-xl text-rose" aria-label="BlushCam home"><Heart size={20} fill="currentColor" /> BlushCam</Link>
        <nav aria-label="Main" className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => <Link key={n.href} href={n.href} aria-current={path === n.href ? 'page' : undefined} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition hover:bg-soft ${path === n.href ? 'bg-soft text-rose' : 'text-ink'}`}>{n.label}</Link>)}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          {user ? <Link href="/dashboard" className="btn-ghost hidden sm:inline-flex">Dashboard</Link> : <Link href="/login" className="btn-ghost hidden sm:inline-flex">Sign in</Link>}
          <Link href="/camera" className="btn-primary"><Camera size={16} /> <span className="hidden sm:inline">Open Camera</span><span className="sm:hidden">Camera</span></Link>
          <button className="btn-ghost !p-2 lg:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen((o) => !o)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="pop absolute inset-x-0 top-16 border-b border-blush/40 bg-cream p-4 shadow-soft lg:hidden">
          <ul className="grid gap-1">{[...NAV, user ? { href: '/dashboard', label: 'Dashboard' } : { href: '/login', label: 'Sign in' }].map((n) => <li key={n.href}><Link href={n.href} className="block rounded-xl px-4 py-3 font-semibold hover:bg-soft">{n.label}</Link></li>)}</ul>
        </nav>
      )}
    </header>
  );
}
