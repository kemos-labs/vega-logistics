import type { Metadata } from 'next';
import { Cairo, IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import './globals.css';
import ClientLayout from '@/components/layout/ClientLayout';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-cairo',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'VEGA — Logistics Business Model',
  description: 'Editable logistics costs, fleet planning, daily operations reporting, risks, and profitability analysis.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`dark ${spaceGrotesk.variable} ${cairo.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
      data-i18n-managed="true"
    >
      <head>
        <meta name="theme-color" content="#10171b" />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className="antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
