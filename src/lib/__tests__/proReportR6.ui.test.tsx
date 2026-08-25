import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/lib/i18n';
import ProReport from '@/components/rebuild/ProReport';
import { buildReportModel } from '@/lib/reportEngine';
import { calculateFinancials } from '@/lib/calculations';
import { defaultFinancialInput } from '@/lib/mockData';
import type { DailyRecord } from '@/lib/operationsReporting';

beforeEach(() => {
  localStorage.clear();
  cleanup();
});

const input = defaultFinancialInput;
const output = calculateFinancials(input);
const FOCUS = new Date('2026-08-14T12:00:00');

function record(date: string, overrides: Partial<DailyRecord> = {}): DailyRecord {
  return {
    date,
    completedShipments: 10,
    failedShipments: 2,
    fuelCost: 100,
    driversPresent: 3,
    notes: '',
    updatedAt: '2026-08-01T10:00:00.000Z',
    closeStatus: 'reconciled',
    ...overrides,
  };
}

function renderProReport(model: ReturnType<typeof buildReportModel>) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ProReport model={model} onClose={() => {}} />
    </I18nextProvider>
  );
}

describe('R6 — ProReport driver scorecard UI', () => {
  it('renders driver scorecard when stops have assigned drivers', () => {
    const stops = [
      { driverName: 'Ahmed', carNumber: '10', plateNumber: 'ABC', status: 'delivered', operationDate: '2026-08-14' },
      { driverName: 'Ahmed', carNumber: '10', plateNumber: 'ABC', status: 'failed', operationDate: '2026-08-14' },
      { driverName: 'Sara', carNumber: '20', plateNumber: 'XYZ', status: 'delivered', operationDate: '2026-08-14' },
    ];
    const records = { '2026-08-14': record('2026-08-14') };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-14'], records, input, output, focusDate: FOCUS, windowDays: 7, stops });
    renderProReport(model);
    expect(screen.getByTestId('driver-scorecard')).toBeTruthy();
    expect(screen.getByText('Ahmed')).toBeTruthy();
    expect(screen.getByText('Sara')).toBeTruthy();
  });

  it('renders empty state when no stops have drivers', () => {
    const records = { '2026-08-14': record('2026-08-14') };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-14'], records, input, output, focusDate: FOCUS, windowDays: 7, stops: [] });
    renderProReport(model);
    expect(screen.getByText(/No stops assigned to drivers yet/i)).toBeTruthy();
  });
});

describe('R6 — ProReport COD remittance lag UI', () => {
  it('renders COD lag table when remittance dates exist', () => {
    const records = {
      '2026-08-12': record('2026-08-12', { cashCollectedSar: 500, cashRemittedSar: 500, codRemittedOn: '2026-08-14' }),
      '2026-08-13': record('2026-08-13', { cashCollectedSar: 300, cashRemittedSar: 300, codRemittedOn: '2026-08-13' }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-13'], records, input, output, focusDate: FOCUS, windowDays: 7 });
    renderProReport(model);
    expect(screen.getByTestId('cod-lag')).toBeTruthy();
    expect(screen.getByText('COD remittance lag')).toBeTruthy();
  });

  it('renders empty state when no remittance dates exist', () => {
    const records = { '2026-08-14': record('2026-08-14') };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-14'], records, input, output, focusDate: FOCUS, windowDays: 7 });
    renderProReport(model);
    expect(screen.getByText(/No remittance dates recorded yet/i)).toBeTruthy();
  });
});

describe('R6 — ProReport fuel control UI', () => {
  it('renders fuel control table when fuel data exists', () => {
    const records = {
      '2026-08-12': record('2026-08-12', { fuelCost: 200 }),
      '2026-08-13': record('2026-08-13', { fuelCost: 150 }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-13'], records, input, output, focusDate: FOCUS, windowDays: 7 });
    renderProReport(model);
    expect(screen.getByTestId('fuel-control')).toBeTruthy();
    expect(screen.getByText('Fuel control')).toBeTruthy();
  });

  it('renders empty state when no fuel data exists (draft only)', () => {
    const records = { '2026-08-14': record('2026-08-14', { closeStatus: 'draft' }) };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-14'], records, input, output, focusDate: FOCUS, windowDays: 7 });
    renderProReport(model);
    expect(screen.getByText(/No recorded daily reports with fuel data yet/i)).toBeTruthy();
  });
});

describe('R6 — ProReport failure Pareto UI', () => {
  it('renders failure Pareto table when failure reasons exist', () => {
    const records = {
      '2026-08-12': record('2026-08-12', { failureReasons: { noDriver: 5, addressIssue: 3, other: 2 } }),
    };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-12'], records, input, output, focusDate: FOCUS, windowDays: 7 });
    renderProReport(model);
    expect(screen.getByTestId('failure-pareto')).toBeTruthy();
    expect(screen.getByText('Failure Pareto')).toBeTruthy();
    // Verify the Pareto table has the right data
    const paretoSection = screen.getByTestId('failure-pareto');
    expect(paretoSection.textContent).toContain('No driver available');
    expect(paretoSection.textContent).toContain('5');
  });

  it('renders empty state when no failure reasons exist', () => {
    const records = { '2026-08-14': record('2026-08-14') };
    const model = buildReportModel({ kind: 'pro', locale: 'en', record: records['2026-08-14'], records, input, output, focusDate: FOCUS, windowDays: 7 });
    renderProReport(model);
    expect(screen.getByText(/No failure reasons recorded yet/i)).toBeTruthy();
  });
});
