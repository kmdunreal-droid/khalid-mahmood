import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export interface ReportSummaryMetric {
  label: string;
  value: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

export interface ExportableReportPayload {
  id: string;
  title: string;
  subtitle: string;
  stationLabel: string;
  generatedAt: string;
  summaryMetrics: ReportSummaryMetric[];
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
}

function buildFileSlug(title: string): string {
  return `petrolops_${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_2026-11-23`;
}

export function exportReportToPdf(report: ExportableReportPayload): void {
  const isWide = report.columns.length >= 6;
  const doc = new jsPDF({
    orientation: isWide ? 'landscape' : 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  // Clean executive header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(`PetrolOps Studio — ${report.title}`, 40, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`${report.stationLabel}  ·  ${report.subtitle}`, 40, 60);
  doc.text(`Generated: ${report.generatedAt}`, 40, 74);

  // Summary metrics grid row
  let cursorY = 92;
  if (report.summaryMetrics.length > 0) {
    autoTable(doc, {
      startY: cursorY,
      head: [report.summaryMetrics.map((m) => m.label)],
      body: [report.summaryMetrics.map((m) => m.value)],
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        cellPadding: 6,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [241, 245, 249],
        textColor: [71, 85, 105],
        fontStyle: 'bold',
      },
      margin: { left: 40, right: 40 },
    });
    const prevY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;
    cursorY = (prevY ?? cursorY + 42) + 16;
  }

  // Main report table
  const columnStyles: Record<number, { halign: 'left' | 'right' }> = {};
  report.columns.forEach((col, idx) => {
    columnStyles[idx] = { halign: col.align === 'right' ? 'right' : 'left' };
  });

  autoTable(doc, {
    startY: cursorY,
    head: [report.columns.map((c) => c.label)],
    body: report.rows.map((r) => report.columns.map((c) => String(r[c.key] ?? ''))),
    theme: 'striped',
    styles: {
      fontSize: 8.5,
      cellPadding: 6,
      textColor: [15, 23, 42],
    },
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    columnStyles,
    margin: { left: 40, right: 40 },
  });

  doc.save(`${buildFileSlug(report.title)}.pdf`);
}

export function exportReportToExcel(report: ExportableReportPayload): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Summary
  const summaryAoa: (string | number)[][] = [
    ['PetrolOps Studio — Management Report'],
    ['Report', report.title],
    ['Station', report.stationLabel],
    ['Scope', report.subtitle],
    ['Generated At', report.generatedAt],
    [],
    ['Key Summary Metrics', 'Value'],
    ...report.summaryMetrics.map((m) => [m.label, m.value]),
  ];
  const summarySheet = XLSX.utils.aoa_to_sheet(summaryAoa);
  summarySheet['!cols'] = [{ wch: 34 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

  // Sheet 2: Detailed Register
  const tableHeader = report.columns.map((c) => c.label);
  const tableRows = report.rows.map((r) =>
    report.columns.map((c) => r[c.key] ?? '')
  );
  const dataSheet = XLSX.utils.aoa_to_sheet([tableHeader, ...tableRows]);
  dataSheet['!cols'] = report.columns.map((col) => ({
    wch: Math.max(col.label.length + 4, 16),
  }));
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Report Data');

  XLSX.writeFile(wb, `${buildFileSlug(report.title)}.xlsx`);
}

export function printCurrentReport(): void {
  window.print();
}

export function buildWhatsAppShareText(report: ExportableReportPayload): string {
  const lines: string[] = [
    `*PetrolOps Studio — ${report.title}*`,
    `${report.stationLabel}`,
    `${report.subtitle}`,
    `Generated: ${report.generatedAt}`,
    '',
    '*Key Metrics:*',
    ...report.summaryMetrics.map((m) => `• ${m.label}: ${m.value}`),
  ];

  if (report.rows.length > 0) {
    lines.push('', '*Highlights:*');
    const previewCols = report.columns.slice(0, 4);
    report.rows.slice(0, 5).forEach((row, idx) => {
      const summaryParts = previewCols.map((c) => `${row[c.key] ?? ''}`).join(' | ');
      lines.push(`${idx + 1}. ${summaryParts}`);
    });
    if (report.rows.length > 5) {
      lines.push(`... +${report.rows.length - 5} more rows`);
    }
  }

  return lines.join('\n');
}
