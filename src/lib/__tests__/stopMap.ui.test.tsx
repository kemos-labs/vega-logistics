// @vitest-environment jsdom
// StopMap UI (keyless Google Maps embed): env-flag gating (R6), lazy iframe
// (no google.com traffic until the user taps "show"), bilingual hl pinning,
// external fallback link always present, encoded query building.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ mockLanguage: 'en' }));

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdparty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      let out = key;
      if (opts) for (const [k, v] of Object.entries(opts)) out += ` ~${k}=${String(v)}~`;
      return out;
    },
    i18n: { get language() { return state.mockLanguage; }, changeLanguage: vi.fn() },
  }),
}));

async function loadComponent() {
  vi.resetModules();
  return import('@/components/rebuild/StopMap');
}

describe('buildMapsQuery / URL builders', () => {
  it('joins label and notes with a plain comma, trimming empties', async () => {
    const mod = await loadComponent();
    expect(mod.buildMapsQuery('حي الملقا', ' قرب المسجد ')).toBe('حي الملقا, قرب المسجد');
    expect(mod.buildMapsQuery('حي الملقا', undefined)).toBe('حي الملقا');
    expect(mod.buildMapsQuery('  ', '  ')).toBe('');
  });

  it('embed src uses the keyless output=embed endpoint with hl pinned', async () => {
    const mod = await loadComponent();
    expect(mod.buildEmbedSrc('Riyadh, Olaya', 'ar'))
      .toBe(`https://maps.google.com/maps?q=${encodeURIComponent('Riyadh, Olaya')}&z=15&hl=ar&output=embed`);
  });

  it('external href is the universal maps search link', async () => {
    const mod = await loadComponent();
    expect(mod.buildExternalHref('Olaya')).toBe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent('Olaya')}`);
  });
});

describe('StopMap rendering under R6 gating', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
    state.mockLanguage = 'en';
  });

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_MAPS_EMBED', '');
  });

  it('renders nothing when the stop has no usable text', async () => {
    const { default: StopMap } = await loadComponent();
    const { container } = render(<StopMap stopLabel="   " addressNotes="  " />);
    expect(container.querySelector('.bm-stop-map')).toBeNull();
  });

  it('flag OFF (default): only the fallback link renders — zero google frames', async () => {
    const { default: StopMap } = await loadComponent();
    render(<StopMap stopLabel="حي الملقا" addressNotes="قرب المسجد" />);
    expect(screen.queryByTestId('map-frame')).toBeNull();
    expect(screen.queryByTestId('map-toggle')).toBeNull();
    const link = screen.getByTestId('map-open') as HTMLAnchorElement;
    expect(link.href).toContain('google.com/maps/search/?api=1&query=');
    expect(link.href).toContain(encodeURIComponent('حي الملقا'));
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('flag ON: nothing loads until tapped; tap shows keyless embed; second tap hides', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPS_EMBED', 'on');
    const { default: StopMap } = await loadComponent();
    render(<StopMap stopLabel="Stop A" addressNotes={undefined} />);
    // Lazy: no iframe network activity until explicit user action
    expect(screen.queryByTestId('map-frame')).toBeNull();
    fireEvent.click(screen.getByTestId('map-toggle'));
    const frame = screen.getByTestId('map-frame') as HTMLIFrameElement;
    expect(frame.src).toContain('maps.google.com/maps?q=');
    expect(frame.src).toContain('output=embed');
    expect(frame.src).toContain('hl=en');
    expect(frame.getAttribute('loading')).toBe('lazy');
    fireEvent.click(screen.getByTestId('map-toggle'));
    expect(screen.queryByTestId('map-frame')).toBeNull();
  });

  it('flag ON + Arabic UI: embed chrome pinned to hl=ar, aria-expanded tracks state', async () => {
    vi.stubEnv('NEXT_PUBLIC_MAPS_EMBED', 'on');
    state.mockLanguage = 'ar';
    const { default: StopMap } = await loadComponent();
    render(<StopMap stopLabel="حي الملقا" addressNotes="قرب المسجد" />);
    const toggle = screen.getByTestId('map-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    const frame = screen.getByTestId('map-frame') as HTMLIFrameElement;
    expect(frame.src).toContain('hl=ar');
    // title comes through the i18n layer with the interpolated label
    expect(frame.title).toContain('frameTitle');
    expect(frame.title).toContain('حي الملقا');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
