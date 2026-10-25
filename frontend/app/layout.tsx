import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '../components/SiteHeader.tsx';

export const metadata: Metadata = {
  title: { default: 'BlushCam — Your Camera, Your Aesthetic', template: '%s · BlushCam' },
  description: 'Aesthetic photo booth, filters, collages and scrapbooks that run privately in your browser.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#F8BBD0' };

const themeScript = `try{var t=localStorage.getItem('blushcam-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&family=Playfair+Display:wght@500;700&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <SiteHeader />
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
