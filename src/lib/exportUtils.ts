import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

interface ExportOptions {
  filename?: string;
  title?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Export HTML element to PDF
 */
export async function exportToPDF(
  elementId: string,
  options: ExportOptions = {}
): Promise<void> {
  const {
    filename = 'export.pdf',
    title = 'Levered Beta Logistics Report',
    orientation = 'portrait',
  } = options;

  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    // Convert HTML to canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0a0a0b',
    });

    // Create PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    // Add title
    pdf.setFontSize(16);
    pdf.text(title, 10, 10);
    position = 20;

    // Add image
    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 30;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw error;
  }
}

/**
 * Export data to Excel
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  options: ExportOptions = {}
): void {
  const { filename = 'export.xlsx' } = options;

  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');

    // Auto-size columns
    const columnWidths = Object.keys(data[0] || {}).map(() => 15);
    worksheet['!cols'] = columnWidths.map((width) => ({ wch: width }));

    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw error;
  }
}

/**
 * Export financial data to Excel with multiple sheets
 */
export function exportFinancialReport(
  reportData: {
    summary: Record<string, unknown>;
    monthlyCosts: Record<string, unknown>[];
    scenarios: Record<string, unknown>[];
  },
  filename: string = 'financial-report.xlsx'
): void {
  try {
    const workbook = XLSX.utils.book_new();

    // Summary sheet
    const summarySheet = XLSX.utils.json_to_sheet([reportData.summary]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    // Monthly costs sheet
    const costsSheet = XLSX.utils.json_to_sheet(reportData.monthlyCosts);
    XLSX.utils.book_append_sheet(workbook, costsSheet, 'Monthly Costs');

    // Scenarios sheet
    const scenariosSheet = XLSX.utils.json_to_sheet(reportData.scenarios);
    XLSX.utils.book_append_sheet(workbook, scenariosSheet, 'Scenarios');

    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error('Error exporting financial report:', error);
    throw error;
  }
}

/**
 * Generate screenshot of element and download as PNG
 */
export async function exportScreenshot(
  elementId: string,
  filename: string = 'screenshot.png'
): Promise<void> {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID "${elementId}" not found`);
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0a0a0b',
    });

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    link.click();
  } catch (error) {
    console.error('Error exporting screenshot:', error);
    throw error;
  }
}
