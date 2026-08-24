// VEGA — Compliance-lite UI tests (R5): EN/AR render, format-only labels,
// draft receipt with QR payload, and prohibited-claim discipline (AGENTS.md R8).
import { describe, expect, it, beforeEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import { ComplianceLiteView } from '@/components/rebuild/ComplianceLiteView';
import { readFileSync } from 'node:fs';

function renderView() {
  return render(<I18nextProvider i18n={i18n}><ComplianceLiteView /></I18nextProvider>);
}

beforeEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
});

describe('ComplianceLiteView', () => {
  it('renders EN with format-only disclaimer and empty address status', () => {
    renderView();
    expect(screen.getByTestId('compliance-lite')).toBeDefined();
    expect(screen.getAllByText(/Format check only/i).length).toBeGreaterThan(0);
    expect(screen.getByTestId('address-status').textContent).toContain('Missing');
  });

  it('flags complete address + valid short address (EN)', () => {
    renderView();
    fireEvent.change(screen.getByLabelText('Building number'), { target: { value: '8227' } });
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'King Fahd Rd' } });
    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'Al Olaya' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Riyadh' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '12212' } });
    fireEvent.change(screen.getByLabelText(/Short Address/), { target: { value: 'RDKA2431' } });
    expect(screen.getByTestId('address-status').textContent).toContain('All address fields present');
  });

  it('rejects invalid short address format without claiming anything about validity', () => {
    renderView();
    fireEvent.change(screen.getByLabelText(/Short Address/), { target: { value: '2431RDKA' } });
    expect(screen.getByTestId('address-status').textContent).toContain('format invalid');
    expect(screen.getByTestId('address-status').textContent).toContain('format check only');
  });

  it('builds a draft receipt row with derived VAT and a QR payload (EN)', () => {
    renderView();
    fireEvent.change(screen.getByLabelText('Issue date (YYYY-MM-DD)'), { target: { value: '2026-03-01' } });
    fireEvent.change(screen.getByLabelText('Supplier name'), { target: { value: 'Bobs Records' } });
    fireEvent.change(screen.getByLabelText('Supplier address'), { target: { value: 'Riyadh' } });
    fireEvent.change(screen.getByLabelText('VAT registration number'), { target: { value: '310122393500003' } });
    fireEvent.change(screen.getByLabelText(/Description/), { target: { value: 'Delivery service' } });
    fireEvent.change(screen.getByLabelText(/Total incl\. VAT/), { target: { value: '115.00' } });
    const receipt = screen.getByTestId('receipt-draft');
    expect(receipt.textContent).toContain('100.00');   // net
    expect(receipt.textContent).toContain('15.00');    // VAT
    expect((screen.getByTestId('qr-payload') as HTMLElement).textContent.startsWith('AQ')).toBe(true);
    expect(receipt.textContent).toMatch(/not an issued tax document/i);
  });

  it('shows validation errors when required fields missing', () => {
    renderView();
    fireEvent.change(screen.getByLabelText(/Total incl\. VAT/), { target: { value: '115' } });
    expect(screen.getByRole('alert').textContent).toContain('missing or invalid');
  });

  it('renders Arabic natively with RTL-safe wording (no calque of "compliance")', async () => {
    await i18n.changeLanguage('ar');
    renderView();
    expect(screen.getByTestId('compliance-lite').textContent).toContain('جاهزية البيانات');
    expect(screen.getAllByText(/فحص تنسيق فقط/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('address-status').textContent).toContain('ناقص');
    // Latin digits in Arabic UI (typography law)
    expect(screen.getByLabelText('الرمز المختصر (4 أحرف + 4 أرقام)')).toBeDefined();
  });

  it('locale trees carry no prohibited claims (R8 lint-time grep)', () => {
    for (const lang of ['en', 'ar'] as const) {
      const text = readFileSync(`public/locales/${lang}/translation.json`, 'utf8');
      for (const banned of ['ZATCA compliant', 'متوافق مع هيئة الزكاة', 'verified National Address',
        'العنوان الوطني الموثق', 'production ready', 'legally valid transport document']) {
        expect(text.toLowerCase()).not.toContain(banned.toLowerCase());
      }
    }
  });
});
