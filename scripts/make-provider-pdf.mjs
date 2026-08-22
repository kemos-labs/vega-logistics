/* Provider daily report → Pine Ledger style PDF (Arabic RTL, vector charts).
 * Mirrors the in-app report engine design language:
 * pine cover band · KPI cards · stacked delivery bars vs loaded target ·
 * insights box · confidential footer.
 * Terminology: تحميل = loaded (target/attempts) · توصيل = delivered · راجع = returned.
 */
import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';

const DAYS = [
  { date: '2026-08-20', label: '20/08', driver: 'يعقوب عبدالقادر', car: '10', plate: '4684', loaded: 25, delivered: 16, returned: 9, cash: true, note: '' },
  { date: '2026-08-21', label: '21/08', driver: 'يعقوب عبدالقادر', car: '10', plate: '4468', loaded: 26, delivered: 21, returned: 5, cash: true, note: 'اللوحة كما وردت في التقرير' },
  { date: '2026-08-22', label: '22/08', driver: 'يعقوب عبدالقادر', car: '10', plate: '4684', loaded: 0, delivered: 0, returned: 0, cash: false, note: 'لا يوجد شحنات في المستودع' },
];
const TOTALS = {
  loaded: DAYS.reduce((s, d) => s + d.loaded, 0),
  delivered: DAYS.reduce((s, d) => s + d.delivered, 0),
  returned: DAYS.reduce((s, d) => s + d.returned, 0),
};
TOTALS.ratePercent = Number((TOTALS.delivered / TOTALS.loaded * 100).toFixed(1));

const THEME = {
  pineDeep: [19, 41, 31], pine: [28, 74, 54], brass: [164, 118, 31], red: [172, 58, 46],
  paper: [251, 250, 244], ink: [27, 35, 30], muted: [95, 105, 97], line: [221, 215, 196],
};

/* ── Arabic fonts (IBM Plex Sans Arabic, OFL — self-hosted) ── */
const FONT_DIR = path.resolve('public/fonts');
function embedFonts(doc) {
  for (const [file, style] of [
    ['IBMPlexSansArabic-Regular.ttf', 'normal'],
    ['IBMPlexSansArabic-SemiBold.ttf', 'semibold'],
    ['IBMPlexSansArabic-Bold.ttf', 'bold'],
  ]) {
    const base64 = fs.readFileSync(path.join(FONT_DIR, file)).toString('base64');
    doc.addFileToVFS(file, base64);
    doc.addFont(file, 'PlexArabic', style);
  }
}

const doc = new jsPDF();
embedFonts(doc);
let y = 16;
const setFont = (size, style = 'normal', color = THEME.ink) => {
  doc.setFont('PlexArabic', style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
};
const text = (value, x, { size = 10, style = 'normal', color = THEME.ink, align = 'right' } = {}) => {
  setFont(size, style, color);
  doc.text(value, x, y, { align });
};
const band = (height, color) => {
  doc.setFillColor(...color);
  doc.rect(0, y - height + 8, 210, height, 'F');
};

/* ── Cover band ── */
band(40, THEME.pineDeep);
y = 20;
text('تقرير العمليات اليومي — المزوّد', 192, { size: 19, style: 'bold', color: [245, 246, 236] });
y += 8;
text('Provider Daily Operations Report', 192, { size: 10.5, style: 'normal', color: [180, 196, 178] });
y += 8;
text('VEGA Logistics OS · الفترة: 20 – 22 أغسطس 2026', 192, { size: 9.5, color: [214, 222, 210] });
y = 48;

/* Driver identity strip */
setFont(11, 'semibold');
doc.text('يعقوب عبدالقادر · سيارة #10 · لوحات 4684 / 4468', 192, y, { align: 'right' });
y += 6;
setFont(9, 'normal', THEME.muted);
doc.text('3 أيام مسجّلة · الكاش مُسلَّم للمستودع يومي 20 و 21 أغسطس', 192, y, { align: 'right' });
y += 12;

/* ── KPI cards (2 rows × grid of 4) ── */
const cards = [
  { label: 'تحميل', value: String(TOTALS.loaded), tone: THEME.ink },
  { label: 'توصيل', value: String(TOTALS.delivered), tone: THEME.pine },
  { label: 'راجع', value: String(TOTALS.returned), tone: TOTALS.returned > 0 ? THEME.red : null },
  { label: 'نسبة التوصيل', value: `${TOTALS.ratePercent}%`, tone: TOTALS.ratePercent >= 70 ? THEME.pine : THEME.brass },
];
const cardWidth = 43, gap = 3.5;
cards.forEach((card, index) => {
  const x = 192 - cardWidth - index * (cardWidth + gap);
  doc.setFillColor(...THEME.paper);
  doc.setDrawColor(...THEME.line);
  doc.roundedRect(x, y, cardWidth, 20, 2, 2, 'FD');
  setFont(7.5, 'normal', THEME.muted);
  doc.text(card.label, x + cardWidth / 2, y + 6.5, { align: 'center' });
  setFont(14, 'semibold', card.tone ?? THEME.ink);
  doc.text(card.value, x + cardWidth / 2, y + 15, { align: 'center' });
});
y += 30;

/* ── Delivery chart: stacked delivered/returned vs loaded target ── */
setFont(12, 'semibold');
doc.text('أداء التوصيل مقابل التحميل', 192, y, { align: 'right' });
y += 6;
{
  const chartX = 18, chartW = 174, chartH = 52;
  const baseY = y + chartH;
  const maxBar = Math.max(...DAYS.map(day => Math.max(day.loaded, day.delivered + day.returned)), 1);
  const slot = chartW / DAYS.length;
  const barWidth = 18;
  doc.setDrawColor(...THEME.line);
  doc.setLineWidth(0.3);
  doc.line(chartX, baseY, chartX + chartW, baseY);
  DAYS.forEach((day, index) => {
    const centerX = chartX + slot * index + slot / 2;
    const scale = value => value / maxBar * (chartH - 8);
    if (day.loaded === 0 && day.delivered === 0) {
      setFont(8, 'normal', THEME.muted);
      doc.text('لا شحنات', centerX, baseY - 4, { align: 'center' });
    } else {
      const dh = scale(day.delivered);
      const rh = scale(day.returned);
      doc.setFillColor(...THEME.pine);
      doc.rect(centerX - barWidth / 2, baseY - dh, barWidth, dh, 'F');
      if (day.returned > 0) {
        doc.setFillColor(...THEME.red);
        doc.rect(centerX - barWidth / 2, baseY - dh - rh, barWidth, rh, 'F');
      }
      // Loaded target tick (brass)
      doc.setDrawColor(...THEME.brass);
      doc.setLineWidth(0.6);
      const ty = baseY - scale(day.loaded);
      doc.line(centerX - barWidth / 2 - 3, ty, centerX + barWidth / 2 + 3, ty);
    }
    setFont(8.5, 'normal', THEME.muted);
    doc.text(day.label, centerX, baseY + 5, { align: 'center' });
  });
  // Legend
  let lx = 192;
  [['توصيل', THEME.pine], ['راجع', THEME.red], ['تحميل', THEME.brass]].forEach(([label, color]) => {
    doc.setFillColor(...color);
    doc.rect(lx - 4, y + chartH + 10, 3.6, 3.6, 'F');
    setFont(8, 'normal', THEME.muted);
    doc.text(label, lx - 6, y + chartH + 13.4, { align: 'right' });
    lx -= doc.getTextWidth(label) + 14;
  });
  y = baseY + 20;
}

/* ── Daily table ── */
setFont(12, 'semibold');
doc.text('اليوميات', 192, y, { align: 'right' });
y += 7;
{
  const headers = ['التاريخ', 'تحميل', 'توصيل', 'راجع', 'النسبة', 'الكاش'];
  const width = 174, left = 18, colW = width / headers.length;
  doc.setFillColor(...THEME.paper);
  doc.rect(left, y - 5, width, 9, 'F');
  headers.forEach((title, index) => {
    setFont(8, 'semibold', THEME.muted);
    doc.text(title, left + colW * index + colW / 2, y + 1, { align: 'center' });
  });
  y += 9;
  DAYS.forEach((day, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(247, 245, 236);
      doc.rect(left, y - 5, width, 9, 'F');
    }
    const rate = day.loaded > 0 ? `${(day.delivered / day.loaded * 100).toFixed(1)}%` : '—';
    const cells = [day.label.slice(0, 5), String(day.loaded), String(day.delivered), String(day.returned), rate, day.cash ? 'مُسلَّم ✓' : '—'];
    cells.forEach((cell, cellIndex) => {
      const numeric = cellIndex >= 1 && cellIndex <= 4;
      const color = cellIndex === 3 && day.returned > 0 ? THEME.red
        : cellIndex === 2 ? THEME.pine
        : numeric ? THEME.ink
        : THEME.muted;
      setFont(numeric ? 9.5 : 8.5, cellIndex === 4 || cellIndex === 2 ? 'semibold' : 'normal', color);
      doc.text(cell, left + colW * cellIndex + colW / 2, y + 1, { align: 'center' });
    });
    y += 9;
  });
  // Totals row
  doc.setFillColor(...THEME.greenTint ?? [223, 234, 221]);
  doc.rect(left, y - 5, width, 9, 'F');
  const totalsCells = ['الإجمالي', String(TOTALS.loaded), String(TOTALS.delivered), String(TOTALS.returned), `${TOTALS.ratePercent}%`, '—'];
  totalsCells.forEach((cell, cellIndex) => {
    setFont(9, 'semibold', cellIndex === 0 ? THEME.pine : THEME.ink);
    doc.text(cell, left + colW * cellIndex + colW / 2, y + 1, { align: 'center' });
  });
  y += 14;
}

/* ── Insights ── */
setFont(12, 'semibold');
doc.text('استنتاجات', 192, y, { align: 'right' });
y += 6;
const insights = [
  { level: 'good', text: 'تحسّن واضح: نسبة الفوات هبطت من 36% يوم 20 إلى 19% يوم 21.' },
  { level: 'warn', text: 'لا توجد شحنات يوم 22 — تأكد من وصول الحمولة أو سبب التوقف.' },
  { level: 'warn', text: 'رقم اللوحة اختلف بين اليومين (4684 ثم 4468) — وحّد التسجيل.' },
  { level: 'good', text: 'الكاش مُسلَّم للمستودع في كلا يومي التشغيل — لا مبالغ قائمة.' },
];
const boxHeight = insights.length * 7.5 + 4;
doc.setFillColor(247, 245, 236);
doc.roundedRect(18, y - 4, 174, boxHeight, 2, 2, 'F');
insights.forEach(insight => {
  const color = insight.level === 'bad' ? THEME.red : insight.level === 'warn' ? THEME.brass : THEME.pine;
  doc.setFillColor(...color);
  doc.circle(186, y + 1.2, 1.1, 'F');
  setFont(9.5, 'normal', THEME.ink);
  doc.text(insight.text, 182, y + 2.2, { align: 'right' });
  y += 7.5;
});
y += 6;

/* ── Footer ── */
setFont(7.5, 'normal', THEME.muted);
doc.text('مستند تخطيط داخلي — مُنشأ من نموذج VEGA المحلي. تحقق من المدخلات قبل الاستخدام التشغيلي.', 105, 290, { align: 'center' });
doc.text('VEGA · 2026', 18, 290, { align: 'left' });

fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/provider-daily-report-2026-08-20_22.pdf', Buffer.from(doc.output('arraybuffer')));
console.log('written: reports/provider-daily-report-2026-08-20_22.pdf');
