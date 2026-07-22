import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BRAND_COLOR: [number, number, number] = [26, 58, 92];  // #1a3a5c
const ACCENT:      [number, number, number] = [56, 196, 87]; // #38c457

@Injectable({ providedIn: 'root' })
export class ExportService {

  /** Télécharge un fichier CSV */
  exportCsv(rows: Record<string, unknown>[], filename: string, columns: { key: string; label: string }[]): void {
    const header = columns.map(c => `"${c.label}"`).join(';');
    const lines  = rows.map(row =>
      columns.map(c => {
        const v = row[c.key] ?? '';
        return `"${String(v).replace(/"/g, '""')}"`;
      }).join(';')
    );
    const bom     = '﻿'; // UTF-8 BOM pour Excel
    const content = bom + [header, ...lines].join('\r\n');
    this.download(content, `${filename}.csv`, 'text/csv;charset=utf-8;');
  }

  /** Génère un vrai PDF via jsPDF et le télécharge directement */
  exportPdf(title: string, columns: { key: string; label: string }[], rows: Record<string, unknown>[]): void {
    const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    this.addHeader(doc, title, date);

    autoTable(doc, {
      startY: 28,
      head: [columns.map(c => c.label)],
      body: rows.map(row => columns.map(c => String(row[c.key] ?? '—'))),
      styles: { fontSize: 9, cellPadding: 3, textColor: [33, 33, 33] },
      headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: [245, 248, 255] },
      margin: { left: 10, right: 10 },
    });

    this.addFooter(doc);
    doc.save(`${this.sanitize(title)}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  /** Génère un PDF multi-sections avec KPI cards */
  exportMultiSectionPdf(
    title: string,
    kpis: { label: string; value: string | number }[],
    sections: { title: string; columns: { key: string; label: string }[]; rows: Record<string, unknown>[] }[]
  ): void {
    const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
    const pageW = doc.internal.pageSize.getWidth();

    this.addHeader(doc, title, date);

    // KPI cards row
    let y = 28;
    if (kpis.length > 0) {
      const cardW  = Math.min(40, (pageW - 20) / kpis.length - 4);
      const startX = 10;
      kpis.forEach((kpi, i) => {
        const x = startX + i * (cardW + 4);
        doc.setFillColor(232, 237, 245);
        doc.setDrawColor(...BRAND_COLOR);
        doc.setLineWidth(0.5);
        doc.roundedRect(x, y, cardW, 18, 2, 2, 'FD');
        // coloured left border accent
        doc.setFillColor(...BRAND_COLOR);
        doc.rect(x, y, 2, 18, 'F');

        doc.setFontSize(14);
        doc.setTextColor(...BRAND_COLOR);
        doc.setFont('helvetica', 'bold');
        doc.text(String(kpi.value), x + 4, y + 11);

        doc.setFontSize(7);
        doc.setTextColor(84, 110, 122);
        doc.setFont('helvetica', 'normal');
        doc.text(kpi.label, x + 4, y + 16);
      });
      y += 24;
    }

    // Sections
    sections.forEach(section => {
      doc.setFontSize(10);
      doc.setTextColor(...BRAND_COLOR);
      doc.setFont('helvetica', 'bold');
      doc.text(section.title, 10, y + 5);
      doc.setDrawColor(...BRAND_COLOR);
      doc.setLineWidth(0.4);
      doc.line(10, y + 6, pageW - 10, y + 6);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [section.columns.map(c => c.label)],
        body: section.rows.map(row => section.columns.map(c => String(row[c.key] ?? '—'))),
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [33, 33, 33] },
        headStyles: { fillColor: BRAND_COLOR, textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [245, 248, 255] },
        margin: { left: 10, right: 10 },
        didDrawPage: (data) => { y = data.cursor?.y ?? y; },
      });

      y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
    });

    this.addFooter(doc);
    doc.save(`${this.sanitize(title)}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  private addHeader(doc: jsPDF, title: string, date: string): void {
    const pageW = doc.internal.pageSize.getWidth();
    doc.setFillColor(...BRAND_COLOR);
    doc.rect(0, 0, pageW, 12, 'F');
    doc.setFontSize(11);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('BETNABISO', 10, 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(title, pageW / 2, 8, { align: 'center' });
    doc.text(date, pageW - 10, 8, { align: 'right' });
  }

  private addFooter(doc: jsPDF): void {
    const pageCount = doc.getNumberOfPages();
    const pageW     = doc.internal.pageSize.getWidth();
    const pageH     = doc.internal.pageSize.getHeight();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text(`Page ${i} / ${pageCount}`, pageW / 2, pageH - 4, { align: 'center' });
      doc.text('Confidentiel — BETNABISO', 10, pageH - 4);
    }
  }

  private sanitize(s: string): string {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  private download(content: string, filename: string, mime: string): void {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }
}
