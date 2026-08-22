import type { MetadataRoute } from 'next';

/** PWA manifest — step 1 of mobile field-operations support: the app can be
 *  installed to a phone home screen. Service worker (full offline) is a
 *  later, separate increment. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VEGA Logistics OS',
    short_name: 'VEGA',
    description: 'Daily logistics operations: fleet planning, delivery follow-up, recovery board, and bilingual reporting.',
    start_url: '.',
    display: 'standalone',
    background_color: '#13291f',
    theme_color: '#13291f',
    icons: [
      { src: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
      { src: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
    ],
  };
}
