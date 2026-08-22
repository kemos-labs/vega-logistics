/* Provider daily report → styled Arabic Excel (RTL).
 * Terminology mapping: تحميل = loaded/attempts · توصيل = delivered · راجع = returned. */
import ExcelJS from 'exceljs';

const rows = [
  { date: '2026-08-20', driver: 'يعقوب عبدالقادر', car: '10', plate: '4684', loaded: 25, delivered: 16, returned: 9, cashNote: 'تم تسليم الكاش للمستودع ✓', dayNote: '' },
  { date: '2026-08-21', driver: 'يعقوب عبدالقادر', car: '10', plate: '4468', loaded: 26, delivered: 21, returned: 5, cashNote: 'تم تسليم الكاش للمستودع ✓', dayNote: 'اللوحة كما وردت في التقرير' },
  { date: '2026-08-22', driver: 'يعقوب عبدالقادر', car: '10', plate: '4684', loaded: 0, delivered: 0, returned: 0, cashNote: '—', dayNote: 'لا يوجد شحنات في المستودع' },
];

const workbook = new ExcelJS.Workbook();
workbook.creator = 'VEGA Logistics OS';
const sheet = workbook.addWorksheet('تقرير يومي', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }] });

sheet.columns = [
  { header: 'التاريخ', key: 'date', width: 14 },
  { header: 'السائق', key: 'driver', width: 24 },
  { header: 'السيارة', key: 'car', width: 10 },
  { header: 'اللوحة', key: 'plate', width: 12 },
  { header: 'تحميل', key: 'loaded', width: 10 },
  { header: 'توصيل', key: 'delivered', width: 10 },
  { header: 'راجع', key: 'returned', width: 10 },
  { header: 'نسبة التوصيل %', key: 'rate', width: 16 },
  { header: 'الكاش', key: 'cash', width: 30 },
  { header: 'ملاحظات', key: 'note', width: 34 },
];

const header = sheet.getRow(1);
header.font = { bold: true, color: { argb: 'FFF4F6EE' }, size: 12 };
header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C4A36' } };
header.alignment = { horizontal: 'center', vertical: 'middle' };
header.height = 24;

for (const row of rows) {
  const rate = row.loaded > 0 ? (row.delivered / row.loaded) * 100 : null;
  const added = sheet.addRow({
    date: row.date, driver: row.driver, car: row.car, plate: row.plate,
    loaded: row.loaded, delivered: row.delivered, returned: row.returned,
    rate: rate === null ? '—' : Number(rate.toFixed(1)),
    cash: row.cashNote, note: row.dayNote,
  });
  added.alignment = { horizontal: 'center', vertical: 'middle' };
  const rateCell = added.getCell('rate');
  if (typeof rateCell.value === 'number') {
    rateCell.font = { bold: true, color: { argb: rate >= 70 ? 'FF1C4A36' : 'FFAC3A2E' } };
  }
  added.getCell('date').numFmt = 'dd/mm/yyyy';
}

// Totals row
const totalsLoaded = rows.reduce((s, r) => s + r.loaded, 0);
const totalsDelivered = rows.reduce((s, r) => s + r.delivered, 0);
const totalsReturned = rows.reduce((s, r) => s + r.returned, 0);
const totalRow = sheet.addRow({
  date: 'الإجمالي', driver: '', car: '', plate: '',
  loaded: totalsLoaded, delivered: totalsDelivered, returned: totalsReturned,
  rate: Number(((totalsDelivered / totalsLoaded) * 100).toFixed(1)),
  cash: '', note: `3 أيام`,
});
totalRow.font = { bold: true, color: { argb: 'FF1B231E' } };
totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFECE0' } };
totalRow.alignment = { horizontal: 'center', vertical: 'middle' };

// Borders for the data region
for (let i = 1; i <= sheet.rowCount; i += 1) {
  sheet.getRow(i).eachCell(cell => {
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDD7C4' } } };
  });
}

await workbook.xlsx.writeFile('reports/provider-daily-report-2026-08-20_22.xlsx');
console.log('written: reports/provider-daily-report-2026-08-20_22.xlsx');
console.log(`totals: تحميل ${totalsLoaded} · توصيل ${totalsDelivered} · راجع ${totalsReturned} · نسبة ${(totalsDelivered / totalsLoaded * 100).toFixed(1)}%`);
