import type { Metadata } from 'next';
import { Archivo, Cairo, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';
import ClientLayout from '@/components/layout/ClientLayout';

const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-archivo',
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
      className={`dark ${archivo.variable} ${cairo.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
      data-i18n-managed="true"
    >
      <head>
        <meta name="theme-color" content="#13291f" />
      </head>
      <body className="antialiased">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
