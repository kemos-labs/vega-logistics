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
  const XLSX = await import('xlsx');
  const metrics = calculateDailyMetrics(record, input, output);
  const workbook = XLSX.utils.book_new();
  const summary = XLSX.utils.aoa_to_sheet([
    ['VEGA Business Model', 'Current value'],
    ['Monthly revenue', amount(output.totalRevenue)], ['Monthly cost', amount(output.totalCost)],
    ['Monthly profit / loss', amount(output.netMargin)], ['Net margin %', amount(output.netMarginPercent)],
    ['Shipments / day', output.totalDailyShipments], ['Cars and drivers', input.companyDriverCount],
    ['Cost / shipment', amount(output.costPerShipment)], ['Revenue / shipment', amount(output.avgRevenuePerShipment)],
  ]);
  const daily = XLSX.utils.aoa_to_sheet([
    ['Daily report', record.date], ['Planned shipments', metrics.plannedShipments],
    ['Completed shipments', record.completedShipments], ['Failed shipments', record.failedShipments],
    ['Completion rate %', amount(metrics.completionRate)], ['Drivers present', record.driversPresent],
    ['Fuel litres', amount(record.fuelLitres)], ['Fuel cost', amount(metrics.fuelCost)],
    ['Revenue', amount(metrics.revenue)], ['Allocated cost', amount(metrics.allocatedCost)],
    ['Profit / loss', amount(metrics.profit)], ['Notes', record.notes],
  ]);
  const costs = XLSX.utils.json_to_sheet([
    { Category: 'Vehicle ownership', 'Monthly SAR': amount(output.costBreakdown.vehicleOwnership) },
    { Category: 'Vehicle running', 'Monthly SAR': amount(output.costBreakdown.vehicleRunning) },
    { Category: 'People', 'Monthly SAR': amount(output.costBreakdown.people) },
    { Category: 'Facilities', 'Monthly SAR': amount(output.costBreakdown.facilities) },
    { Category: 'Per shipment', 'Monthly SAR': amount(output.costBreakdown.perShipment) },
    { Category: 'Other', 'Monthly SAR': amount(output.costBreakdown.other) },
  ]);
  const fleet = XLSX.utils.json_to_sheet(input.vehicleClasses.map(vehicle => ({
    'Vehicle type': vehicle.name, Quantity: vehicle.quantity, 'Rent / vehicle': vehicle.monthlyRent,
    'Insurance + maintenance': vehicle.variableCost, 'Fuel L/100km': vehicle.fuelEfficiency,
    'Distance km/day': vehicle.avgDailyDistance,
  })));
  const customers = XLSX.utils.json_to_sheet(input.providers.map(provider => ({
    Customer: provider.name, 'Shipments / day': provider.shipmentsPerDay,
    'Price / shipment': provider.pricePerShipment, Enabled: provider.enabled ? 'Yes' : 'No',
  })));
  [summary, daily, costs, fleet, customers].forEach(sheet => { sheet['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 20 }]; });
  XLSX.utils.book_append_sheet(workbook, summary, 'Summary');
  XLSX.utils.book_append_sheet(workbook, daily, 'Daily report');
  XLSX.utils.book_append_sheet(workbook, costs, 'Company costs');
  XLSX.utils.book_append_sheet(workbook, fleet, 'Cars and drivers');
  XLSX.utils.book_append_sheet(workbook, customers, 'Customers');
  XLSX.writeFile(workbook, `vega-business-model-${record.date}.xlsx`);
}
