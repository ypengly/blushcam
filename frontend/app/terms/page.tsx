import type { Metadata } from 'next';
import { SiteFooter } from '../../components/SiteFooter.tsx';
export const metadata: Metadata = { title: 'Terms' };
export default function Terms() {
  return (<><main className="mx-auto max-w-3xl space-y-4 px-4 py-10">
    <h1 className="font-display text-4xl">Terms of service</h1>
    <p className="text-sm text-muted">Template text for operators: review with a lawyer before launch.</p>
    <p>You keep ownership of the photos and designs you create. You grant BlushCam only the permission needed to store and serve content you choose to save to your account.</p>
    <p>Only upload photos you have the right to use, and don’t use the service to harass, impersonate or exploit others, or to upload unlawful content. Stickers and templates bundled with BlushCam are original artwork provided for use in your creations.</p>
    <p>The service is provided “as is”. Features that depend on third-party providers may be unavailable. We may apply storage quotas and rate limits, and may suspend accounts that abuse the service.</p>
  </main><SiteFooter /></>);
}
