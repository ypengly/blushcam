import { Gallery } from '../../features/gallery/Gallery.tsx';
import { SiteFooter } from '../../components/SiteFooter.tsx';
export const metadata = { title: 'My gallery' };
export default function Page() { return (<><main className="mx-auto max-w-6xl px-4 py-8"><h1 className="mb-6 font-display text-3xl">My gallery</h1><Gallery /></main><SiteFooter /></>); }
