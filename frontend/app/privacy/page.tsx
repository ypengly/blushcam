import type { Metadata } from 'next';
import { SiteFooter } from '../../components/SiteFooter.tsx';
export const metadata: Metadata = { title: 'Privacy' };
export default function Privacy() {
  return (<><main className="prose-blush mx-auto max-w-3xl space-y-5 px-4 py-10 [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-2xl [&_li]:ml-5 [&_li]:list-disc">
    <h1 className="font-display text-4xl">Privacy policy</h1>
    <p className="text-sm text-muted">Template text for operators: review with a lawyer and fill in your company details before launch.</p>
    <h2>Where your photos are processed</h2>
    <ul><li><strong>In your browser (default):</strong> camera, filters, stickers, collage, booth, scrapbook and export all run locally. Nothing is uploaded.</li>
      <li><strong>Saved in this browser:</strong> “Save in browser” stores projects in your browser’s IndexedDB on this device only.</li>
      <li><strong>Saved to your account:</strong> only when you press “Save to account” and confirm. Photos are stored privately and served through short-lived signed links.</li>
      <li><strong>AI tools:</strong> only when you run one and tick the consent box. Classical tools run on our server; tools marked “external provider” send the photo to that third party for that request.</li></ul>
    <h2>Camera</h2><p>We request camera access only after you press a button, show a visible “Camera on” indicator, never record audio, and stop the camera when you leave or turn it off. Video frames are never sent anywhere.</p>
    <h2>What we store</h2><p>Account email, a salted Argon2id password hash, session metadata, and the projects and photos you choose to save. We do not log photo contents, passwords or session tokens.</p>
    <h2>Retention and deletion</h2><p>You can delete projects any time. Deleting your account removes your profile, projects and uploaded assets. Temporary uploads that were never attached to a project are removed after 24 hours. Expired sessions and password-reset tokens are purged automatically.</p>
    <h2>Third parties</h2><p>If the operator configures an external AI provider, it is named in the AI studio and listed here by the operator. Operators must list the provider’s retention terms.</p>
    <h2>Contact</h2><p>Set <code>NEXT_PUBLIC_CONTACT_EMAIL</code> to show a contact address in the footer.</p>
  </main><SiteFooter /></>);
}
