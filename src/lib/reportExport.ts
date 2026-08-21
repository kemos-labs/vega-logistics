import type { FinancialInput, FinancialOutput } from '@/lib/types';
import { calculateDailyMetrics, type DailyRecord } from '@/lib/operationsReporting';

const amount = (value: number) => Math.round(value * 100) / 100;

export async function exportDailyReportPdf(record: DailyRecord, input: FinancialInput, output: FinancialOutput) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const metrics = calculateDailyMetrics(record, input, output);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('VEGA Daily Operations Report', 18, 22);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Report date: ${record.date}`, 18, 31);
  doc.text(record.updatedAt ? `Recorded: ${new Date(record.updatedAt).toLocaleString('en-SA')}` : 'Status: unsaved draft', 18, 37);
  doc.setTextColor(20);
  const rows = [
    ['Planned shipments', metrics.plannedShipments],
    ['Completed shipments', record.completedShipments],
    ['Failed shipments', record.failedShipments],
    ['Completion rate', `${metrics.completionRate.toFixed(1)}%`],
    ['Drivers present', `${record.driversPresent} / ${input.companyDriverCount}`],
    ['Fuel used', `${amount(record.fuelLitres)} L`],
    ['Fuel cost', `SAR ${amount(metrics.fuelCost)}`],
    ['Daily revenue', `SAR ${amount(metrics.revenue)}`],
    ['Allocated daily cost', `SAR ${amount(metrics.allocatedCost)}`],
    ['Daily profit / loss', `SAR ${amount(metrics.profit)}`],
  ];
  let y = 52;
  doc.setFontSize(11);
  rows.forEach(([label, value], index) => {
    if (index % 2 === 0) { doc.setFillColor(244, 246, 243); doc.rect(18, y - 6, 174, 10, 'F'); }
    doc.text(String(label), 22, y);
    doc.setFont('helvetica', 'bold');
    doc.text(String(value), 188, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 10;
  });
  doc.setFont('helvetica', 'bold');
  doc.text('Notes', 18, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(record.notes || 'No notes recorded.', 18, y + 16, { maxWidth: 174 });
  doc.setFontSize(8);
  doc.setTextColor(110);
  doc.text('Generated from the local VEGA business model. Verify inputs before operational use.', 18, 286);
  doc.save(`vega-daily-report-${record.date}.pdf`);
}

export async function exportBusinessModelExcel(record: DailyRecord, input: FinancialInput, output: FinancialOutput) {
  const ExcelJS = await import('exceljs');
  const metrics = calculateDailyMetrics(record, input, output);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'VEGA Logistics OS';

  const summary = workbook.addWorksheet('Summary');
  summary.columns = [{ width: 28 }, { width: 20 }];
  summary.addRows([
    ['VEGA Business Model', 'Current value'],
    ['Monthly revenue', amount(output.totalRevenue)], ['Monthly cost', amount(output.totalCost)],
    ['Monthly profit / loss', amount(output.netMargin)], ['Net margin %', amount(output.netMarginPercent)],
    ['Shipments / day', output.totalDailyShipments], ['Cars and drivers', input.companyDriverCount],
    ['Cost / shipment', amount(output.costPerShipment)], ['Revenue / shipment', amount(output.avgRevenuePerShipment)],
  ]);

  const daily = workbook.addWorksheet('Daily report');
  daily.columns = [{ width: 28 }, { width: 20 }];
  daily.addRows([
    ['Daily report', record.date], ['Planned shipments', metrics.plannedShipments],
    ['Completed shipments', record.completedShipments], ['Failed shipments', record.failedShipments],
    ['Completion rate %', amount(metrics.completionRate)], ['Drivers present', record.driversPresent],
    ['Fuel litres', amount(record.fuelLitres)], ['Fuel cost', amount(metrics.fuelCost)],
    ['Revenue', amount(metrics.revenue)], ['Allocated cost', amount(metrics.allocatedCost)],
    ['Profit / loss', amount(metrics.profit)], ['Notes', record.notes],
  ]);

  const costs = workbook.addWorksheet('Company costs');
  costs.columns = [{ header: 'Category', key: 'category', width: 28 }, { header: 'Monthly SAR', key: 'monthlySar', width: 20 }];
  costs.addRows([
    { category: 'Vehicle ownership', monthlySar: amount(output.costBreakdown.vehicleOwnership) },
    { category: 'Vehicle running', monthlySar: amount(output.costBreakdown.vehicleRunning) },
    { category: 'People', monthlySar: amount(output.costBreakdown.people) },
    { category: 'Facilities', monthlySar: amount(output.costBreakdown.facilities) },
    { category: 'Per shipment', monthlySar: amount(output.costBreakdown.perShipment) },
    { category: 'Other', monthlySar: amount(output.costBreakdown.other) },
  ]);

  const fleet = workbook.addWorksheet('Cars and drivers');
  fleet.columns = [
    { header: 'Vehicle type', key: 'name', width: 28 }, { header: 'Quantity', key: 'quantity', width: 12 },
    { header: 'Rent / vehicle', key: 'rent', width: 20 }, { header: 'Insurance + maintenance', key: 'overhead', width: 24 },
    { header: 'Fuel L/100km', key: 'efficiency', width: 16 }, { header: 'Distance km/day', key: 'distance', width: 18 },
  ];
  input.vehicleClasses.forEach(vehicle => fleet.addRow({
    name: vehicle.name, quantity: vehicle.quantity, rent: vehicle.monthlyRent,
    overhead: vehicle.variableCost, efficiency: vehicle.fuelEfficiency, distance: vehicle.avgDailyDistance,
  }));

  const customers = workbook.addWorksheet('Customers');
  customers.columns = [
    { header: 'Customer', key: 'customer', width: 28 }, { header: 'Shipments / day', key: 'shipmentsPerDay', width: 16 },
    { header: 'Price / shipment', key: 'pricePerShipment', width: 18 }, { header: 'Enabled', key: 'enabled', width: 10 },
  ];
  input.providers.forEach(provider => customers.addRow({
    customer: provider.name, shipmentsPerDay: provider.shipmentsPerDay,
    pricePerShipment: provider.pricePerShipment, enabled: provider.enabled ? 'Yes' : 'No',
  }));

  [costs, fleet, customers].forEach(sheet => sheet.getRow(1).font = { bold: true });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `vega-business-model-${record.date}.xlsx`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
