// Operational report workbook — Company + Driver runs + Stops
// No financial assumptions, no per-driver cash fabrication.
// Typed pure builder + ExcelJS writer, existing dependency only.

import type { DailyRecord } from '@/lib/operationsReporting';
import type { StopRecord } from '@/lib/stops';

export interface OperationalRun {
  key: string;
  driverName: string;
  carNumber?: string;
  plateNumber?: string;
  stops: StopRecord[];
}

export interface OperationalCompanyRow {
  date: string;
  status: string;
  stops: number;
  delivered: number;
  returned: number;
  pending: number;
  codExpected: number;
  collected: number;
  remitted: number;
  outstanding: number;
  uncollected: number;
  overRemitted: number;
  podGaps: number;
}

export function buildOperationalWorkbookData(params: {
  date: string;
  record: DailyRecord;
  stops: StopRecord[];
  runs: OperationalRun[];
}): {
  company: OperationalCompanyRow;
  runs: Array<{ key: string; driverName: string; carNumber: string; plateNumber: string; stops: number; delivered: number; returned: number; pending: number; codExpected: number; podGaps: number }>;
  stopsRows: Array<{ sequence: number; reference: string; customer: string; stopLabel: string; driver: string; car: string; status: string; reason: string; pod: string; cod: number }>;
} {
  const { date, record, stops, runs } = params;
  const delivered = stops.filter(s => s.status === 'delivered').length;
  const returned = stops.filter(s => s.status === 'returned').length;
  const pending = stops.filter(s => s.status === 'pending' || s.status === 'planned' || s.status === 'failed').length;
  const codExpected = stops.filter(s => s.status === 'delivered').reduce((sum, s) => sum + (s.codAmountSar ?? 0), 0);
  const collected = record.cashCollectedSar ?? 0;
  const remitted = record.cashRemittedSar ?? 0;
  const outstanding = Math.max(0, collected - remitted);
  const uncollected = Math.max(0, codExpected - collected);
  const overRemitted = Math.max(0, remitted - collected);
  const podGaps = stops.filter(s => s.status === 'delivered' && s.podStatus !== 'complete').length;
  const status = record.closeStatus === 'reconciled' ? 'reconciled' : !record.closeStatus ? 'legacy' : 'draft';

  const company: OperationalCompanyRow = {
    date, status, stops: stops.length, delivered, returned, pending, codExpected, collected, remitted, outstanding, uncollected, overRemitted, podGaps,
  };

  const runRows = runs.map(r => {
    const del = r.stops.filter(s => s.status === 'delivered').length;
    const ret = r.stops.filter(s => s.status === 'returned').length;
    const pend = r.stops.filter(s => s.status === 'pending' || s.status === 'planned' || s.status === 'failed').length;
    const cod = r.stops.filter(s => s.status === 'delivered').reduce((sum, s) => sum + (s.codAmountSar ?? 0), 0);
    const gaps = r.stops.filter(s => s.status === 'delivered' && s.podStatus !== 'complete').length;
    return {
      key: r.key,
      driverName: r.driverName,
      carNumber: r.carNumber ?? '',
      plateNumber: r.plateNumber ?? '',
      stops: r.stops.length,
      delivered: del,
      returned: ret,
      pending: pend,
      codExpected: cod,
      podGaps: gaps,
    };
  });

  const stopsRows = [...stops]
    .sort((a, b) => (a.sequence ?? 999) - (b.sequence ?? 999) || a.stopLabel.localeCompare(b.stopLabel))
    .map((s, idx) => ({
      sequence: s.sequence ?? idx + 1,
      reference: s.reference ?? '',
      customer: s.customerName,
      stopLabel: s.stopLabel,
      driver: s.driverName ?? '',
      car: s.carNumber ?? '',
      status: s.status,
      reason: s.failureReasonKey ?? '',
      pod: s.podStatus ?? '',
      cod: s.codAmountSar ?? 0,
    }));

  return { company, runs: runRows, stopsRows };
}

export interface OperationalExcelLabels {
  sheets: { company: string; runs: string; stops: string };
  headers: { company: string[]; runs: string[]; stops: string[] };
  status: (value: string) => string;
  stopStatus: (value: string) => string;
  reason: (value: string) => string;
  pod: (value: string) => string;
}

/** Single label source used by the workbook writer and independently testable. */
export function getOperationalExcelLabels(lang: 'en' | 'ar'): OperationalExcelLabels {
  const arabic = lang === 'ar';
  const translate = (value: string, map: Record<string, string>) => arabic ? (map[value] ?? value) : value;
  return {
    sheets: arabic
      ? { company: 'الشركة', runs: 'مسارات السائقين', stops: 'الوقفات' }
      : { company: 'Company', runs: 'Driver runs', stops: 'Stops' },
    headers: arabic
      ? {
          company: ['التاريخ', 'الحالة', 'الوقفات', 'تم التوصيل', 'راجع', 'قيد الانتظار', 'COD متوقع', 'محصل', 'محول', 'مبلغ معلق', 'غير محصل', 'فائض تحويل', 'فجوات POD'],
          runs: ['المفتاح', 'السائق', 'المركبة', 'اللوحة', 'الوقفات', 'تم التوصيل', 'راجع', 'قيد الانتظار', 'COD متوقع', 'فجوات POD'],
          stops: ['تسلسل', 'المرجع', 'العميل', 'الوقفة', 'السائق', 'المركبة', 'الحالة', 'السبب', 'POD', 'COD'],
        }
      : {
          company: ['Date', 'Status', 'Stops', 'Delivered', 'Returned', 'Pending', 'COD expected', 'Collected', 'Remitted', 'Outstanding', 'Uncollected', 'Over-remitted', 'POD gaps'],
          runs: ['Key', 'Driver', 'Vehicle', 'Plate', 'Stops', 'Delivered', 'Returned', 'Pending', 'COD expected', 'POD gaps'],
          stops: ['Seq', 'Reference', 'Customer', 'Stop', 'Driver', 'Vehicle', 'Status', 'Reason', 'POD', 'COD'],
        },
    status: value => translate(value, { reconciled: 'مطابق', legacy: 'مسجل (إرثي)', draft: 'مسودة' }),
    stopStatus: value => translate(value, { delivered: 'تم التوصيل', returned: 'راجع', pending: 'قيد الانتظار', planned: 'مخطط', failed: 'فشل' }),
    reason: value => translate(value, { customerUnavailable: 'العميل غير متاح', addressIssue: 'مشكلة عنوان', vehicleBreakdown: 'عطل مركبة', noDriver: 'لا يوجد سائق', refusedDelivery: 'رفض الاستلام', weatherDelay: 'تأخير طقس', other: 'أخرى' }),
    pod: value => translate(value, { complete: 'مكتمل', partial: 'جزئي', none: 'لا يوجد' }),
  };
}

export async function exportOperationalExcel(params: {
  date: string;
  record: DailyRecord;
  stops: StopRecord[];
  runs: OperationalRun[];
  lang: 'en' | 'ar';
}): Promise<void> {
  const { date, record, stops, runs, lang } = params;
  const data = buildOperationalWorkbookData({ date, record, stops, runs });
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'VEGA Logistics OS';
  const labels = getOperationalExcelLabels(lang);

  const ws1 = wb.addWorksheet(labels.sheets.company);
  ws1.addRow(labels.headers.company);
  ws1.addRow([data.company.date, labels.status(data.company.status), data.company.stops, data.company.delivered, data.company.returned, data.company.pending, data.company.codExpected, data.company.collected, data.company.remitted, data.company.outstanding, data.company.uncollected, data.company.overRemitted, data.company.podGaps]);
  ws1.getRow(1).font = { bold: true };

  const ws2 = wb.addWorksheet(labels.sheets.runs);
  ws2.addRow(labels.headers.runs);
  data.runs.forEach(r => ws2.addRow([r.key, r.driverName, r.carNumber, r.plateNumber, r.stops, r.delivered, r.returned, r.pending, r.codExpected, r.podGaps]));
  ws2.getRow(1).font = { bold: true };

  const ws3 = wb.addWorksheet(labels.sheets.stops);
  ws3.addRow(labels.headers.stops);
  data.stopsRows.forEach(s => ws3.addRow([s.sequence, s.reference, s.customer, s.stopLabel, s.driver, s.car, labels.stopStatus(s.status), labels.reason(s.reason), labels.pod(s.pod), s.cod]));
  ws3.getRow(1).font = { bold: true };

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vega-operations-${date}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
