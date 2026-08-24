// VEGA — keyless Google Maps embed for a stop address.
//
// The free way: Google's keyless `maps.google.com/maps?q=…&output=embed`
// iframe. No API key, no billing account, no JS SDK — the iframe is the
// whole integration. Nothing to pay; usage limits are the same informal
// ones the public maps.google.com site has (fine for a 1-owner, 5–50
// vehicle operation per R10).
//
// R6 law honored:
//  * Env flag — the iframe renders only when NEXT_PUBLIC_MAPS_EMBED=on is
//    set at build time. Default OFF: zero requests to google.com unless the
//    operator explicitly opts in. next.config.ts widens frame-src under the
//    same flag; connect-src stays 'self' (the iframe is not fetch traffic).
//  * Offline fallback — an "open in Google Maps" link ALWAYS renders and
//    deep-links the Maps app on phones; it works even when the embed is
//    disabled or the device has no data. No iframe network activity until
//    the user taps "show".
//  * Privacy — the address text is placed in the iframe/link URL only when
//    the user acts on this specific stop; no background geocoding ever.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

const S = 'businessModel.stops.map.';
const EMBED_ENABLED = process.env.NEXT_PUBLIC_MAPS_EMBED === 'on';

/** Free-text search query for Maps: stop label first, notes as detail. */
export function buildMapsQuery(stopLabel: string, addressNotes?: string): string {
  // Plain ASCII comma — Maps search treats it as a separator in AR and EN.
  return [stopLabel.trim(), addressNotes?.trim()].filter(Boolean).join(', ');
}

/** Keyless embed URL (no API key). hl pins the map chrome language. */
export function buildEmbedSrc(query: string, lang: string): string {
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=15&hl=${lang}&output=embed`;
}

/** Universal link: opens the Maps app on mobile, maps.google.com on desktop. */
export function buildExternalHref(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export default function StopMap({ stopLabel, addressNotes }: {
  stopLabel: string;
  addressNotes?: string;
}) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const query = buildMapsQuery(stopLabel, addressNotes);
  if (!query) return null;

  const lang = i18n.language === 'ar' ? 'ar' : 'en';

  return (
    <div className="bm-stop-map" data-testid="stop-map">
      <span className="bm-stop-map-actions">
        {EMBED_ENABLED && (
          <button type="button" data-testid="map-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
            {open ? t(S + 'hide') : t(S + 'show')}
          </button>
        )}
        <a
          href={buildExternalHref(query)}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="map-open"
        >
          {t(S + 'open')}
        </a>
      </span>
      {EMBED_ENABLED && open && (
        <iframe
          src={buildEmbedSrc(query, lang)}
          title={t(S + 'frameTitle', { label: query })}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          data-testid="map-frame"
        />
      )}
    </div>
  );
}
