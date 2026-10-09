import { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ClientLayout from '@/components/layout/ClientLayout';
import BusinessModelApp from '@/components/rebuild/BusinessModelApp';
import i18n from '@/lib/i18n';
import { defaultFinancialInput } from '@/lib/mockData';
import { pullNemowPackages } from '@/lib/nemowPull';

let root: Root | undefined;
let container: HTMLDivElement;

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('en');
  container = document.createElement('div');
  document.body.appendChild(container);
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
});

afterEach(async () => {
  await act(async () => root?.unmount());
  root = undefined;
  container.remove();
  localStorage.clear();
  await i18n.changeLanguage('en');
  document.documentElement.lang = 'en';
  document.documentElement.dir = 'ltr';
  vi.unstubAllGlobals();
});

describe('ClientLayout initial hydration', () => {
  it.each(['en', 'ar'])('mounts persisted dashboard data after a stable SSR shell (%s)', async language => {
    const input = structuredClone(defaultFinancialInput);
    input.vehicleClasses[0].name = 'Persisted vehicle';
    input.providers[0].shipmentsPerDay = 73;
    const pulled = pullNemowPackages([
      ['باركود', 'مدينة المرسل', 'التحصيل الأصلي', 'الحالة', 'تا ريخ اخر حركة'],
      ['1001', 'الرياض', '367.9', 'تم توصيلها', '09/09/2026 13:00'],
    ], 'persisted-export.xlsx', 'Packages', '2026-09-15T08:00:00.000Z');
    if (!pulled.ok) throw new Error(pulled.error);
    const stored = {
      language,
      'vega-financialInput-v2': JSON.stringify(input),
      'vega-nemow-pull-v1': JSON.stringify(pulled.summary),
    };
    // Server HTML is generated before the browser's persisted state is exposed.
    const app = <ClientLayout><BusinessModelApp /></ClientLayout>;
    const html = renderToString(app);
    expect(html).not.toContain('bm-app');
    expect(html).toContain('visibility:hidden');
    for (const [key, value] of Object.entries(stored)) localStorage.setItem(key, value);
    expect(renderToString(app)).toBe(html);
    container.innerHTML = html;
    const recoverableErrors: unknown[] = [];
    await act(async () => {
      root = hydrateRoot(container, app, { onRecoverableError: error => recoverableErrors.push(error) });
    });
    expect(recoverableErrors).toEqual([]);
    expect(container.querySelector('[data-testid="nemow-meta"]')?.textContent).toContain('persisted-export.xlsx');
    expect(container.querySelector('option[value="Persisted vehicle"]')).not.toBeNull();
    expect(container.querySelector('.bm-kpis')?.textContent).not.toContain('24,570');
    expect(document.documentElement.lang).toBe(language);
    expect(document.documentElement.dir).toBe(language === 'ar' ? 'rtl' : 'ltr');
    expect(container.querySelector('nav')?.textContent).toContain(i18n.t('businessModel.nav.summary'));
    for (const [key, value] of Object.entries(stored)) expect(localStorage.getItem(key)).toBe(value);
  });
});
