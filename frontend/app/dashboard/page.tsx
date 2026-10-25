'use client';
import Link from 'next/link';
import { Camera, Film, LayoutGrid, BookHeart, Wand2 } from 'lucide-react';
import { useUser } from '../../hooks/useUser.ts';
import { Gallery } from '../../features/gallery/Gallery.tsx';

const quick = [{ href: '/camera', label: 'Camera', icon: Camera }, { href: '/booth', label: 'Photo booth', icon: Film }, { href: '/collage', label: 'Collage', icon: LayoutGrid }, { href: '/scrapbook', label: 'Scrapbook', icon: BookHeart }, { href: '/ai-studio', label: 'AI studio', icon: Wand2 }];
export default function Dashboard() {
  const { user } = useUser();
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl">Hi{user?.displayName ? `, ${user.displayName}` : ''} 🌸</h1>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">{quick.map(({ href, label, icon: I }) => <li key={href}><Link href={href} className="card flex flex-col items-center gap-2 !p-4 text-sm font-semibold transition hover:-translate-y-1 hover:shadow-soft"><I className="text-rose" size={22} />{label}</Link></li>)}</ul>
      <h2 className="mb-4 mt-10 font-display text-2xl">Recent creations</h2><Gallery />
    </main>
  );
}
