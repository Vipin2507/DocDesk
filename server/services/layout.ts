import type { DocumentDefinition } from "../../shared/types";

export interface Glyph {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

export interface PageImage {
  dataUrl: string;
  width: number;
  height: number;
}

export interface PageLayout {
  width: number;
  height: number;
  glyphs: Glyph[];
  images: PageImage[];
}

const FIDELITY_WARNING =
  "This PDF was reconstructed from text positions and detected layout. A PDF and a PDFMake definition are different formats, so custom fonts, exact spacing, vector art, and overlapping objects may not match. Compare the original and the preview before using the template.";

interface Line {
  y: number;
  height: number;
  glyphs: Glyph[];
}

interface Cell {
  text: string;
  x: number;
  width: number;
  fontSize: number;
  bold: boolean;
}

function isBold(fontName: string): boolean {
  return /bold|black|semibold|medium|heavy/i.test(fontName);
}

function clusterLines(glyphs: Glyph[]): Line[] {
  const sorted = glyphs.filter((glyph) => glyph.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  for (const glyph of sorted) {
    const last = lines[lines.length - 1];
    const tolerance = Math.max(4, (last?.height || glyph.fontSize) * 0.45);
    if (last && Math.abs(glyph.y - last.y) <= tolerance) {
      last.glyphs.push(glyph);
      last.height = Math.max(last.height, glyph.height || glyph.fontSize);
      last.y = Math.min(last.y, glyph.y);
    } else {
      lines.push({ y: glyph.y, height: glyph.height || glyph.fontSize, glyphs: [glyph] });
    }
  }
  for (const line of lines) line.glyphs.sort((a, b) => a.x - b.x);
  return lines;
}

function lineCells(line: Line): Cell[] {
  const cells: Cell[] = [];
  let current: Cell | null = null;
  for (const glyph of line.glyphs) {
    if (!current) {
      current = {
        text: glyph.text,
        x: glyph.x,
        width: glyph.width,
        fontSize: glyph.fontSize,
        bold: isBold(glyph.fontName),
      };
      continue;
    }
    const gap = glyph.x - (current.x + current.width);
    if (gap > Math.max(18, current.fontSize * 1.5)) {
      cells.push(current);
      current = {
        text: glyph.text,
        x: glyph.x,
        width: glyph.width,
        fontSize: glyph.fontSize,
        bold: isBold(glyph.fontName),
      };
    } else {
      current.text += `${gap > current.fontSize * 0.22 ? " " : ""}${glyph.text}`;
      current.width = glyph.x + glyph.width - current.x;
      current.fontSize = Math.max(current.fontSize, glyph.fontSize);
      current.bold = current.bold || isBold(glyph.fontName);
    }
  }
  if (current) cells.push(current);
  return cells;
}

function tableRun(lines: Line[], start: number): number {
  const first = lineCells(lines[start]);
  if (first.length < 2) return 0;
  let length = 1;
  while (start + length < lines.length) {
    const cells = lineCells(lines[start + length]);
    if (cells.length !== first.length) break;
    const aligned = cells.every((cell, index) => Math.abs(cell.x - first[index].x) < 14);
    if (!aligned) break;
    length += 1;
  }
  return length >= 3 ? length : 0;
}

function alignment(cell: Cell, pageWidth: number): "left" | "center" | "right" {
  const center = cell.x + cell.width / 2;
  if (Math.abs(center - pageWidth / 2) < 36 && cell.x > pageWidth * 0.15) return "center";
  if (cell.x > pageWidth * 0.62) return "right";
  return "left";
}

function namedPage(width: number, height: number): { pageSize: DocumentDefinition["pageSize"]; pageOrientation?: "portrait" | "landscape" } {
  const near = (a: number, b: number) => Math.abs(a - b) < 8;
  if (near(width, 595) && near(height, 842)) return { pageSize: "A4" };
  if (near(width, 842) && near(height, 595)) return { pageSize: "A4", pageOrientation: "landscape" };
  if (near(width, 612) && near(height, 792)) return { pageSize: "LETTER" };
  return { pageSize: { width: Math.round(width), height: Math.round(height) } };
}

function clampSize(size: number): number {
  if (!Number.isFinite(size) || size <= 0) return 11;
  return Math.max(8, Math.min(28, Math.round(size)));
}

export function pagesToDefinition(pages: PageLayout[]): { definition: DocumentDefinition; warnings: string[] } {
  const warnings = [FIDELITY_WARNING];
  if (!pages.length) {
    warnings.push("The PDF did not contain any pages.");
  }
  const content: Record<string, unknown>[] = [];
  let missingImages = false;
  pages.forEach((page, pageIndex) => {
    if (page.images.length === 0) missingImages = true;
    page.images.forEach((image) => {
      content.push({
        image: image.dataUrl,
        width: Math.min(180, image.width || 120),
        margin: [0, pageIndex && content.length === 0 ? 0 : 8, 0, 8],
        ...(pageIndex > 0 && content.length === 0 ? { pageBreak: "before" } : {}),
      });
    });
    const lines = clusterLines(page.glyphs);
    if (!lines.length && !page.images.length) {
      warnings.push(`Page ${pageIndex + 1} has no extractable text. It may be a scan or a drawing.`);
      content.push({
        text: `Page ${pageIndex + 1} had no extractable text.`,
        italics: true,
        color: "#64748b",
        ...(pageIndex > 0 ? { pageBreak: "before" } : {}),
      });
      return;
    }
    let cursor = 0;
    let blockIndex = 0;
    while (cursor < lines.length) {
      const run = tableRun(lines, cursor);
      const pageBreak = pageIndex > 0 && blockIndex === 0 && page.images.length === 0 ? "before" : undefined;
      if (run > 0) {
        const rows = lines.slice(cursor, cursor + run).map((line) => lineCells(line).map((cell) => cell.text.trim()));
        content.push({
          table: { headerRows: 1, widths: Array(rows[0]?.length || 1).fill("*"), body: rows },
          layout: "lightHorizontalLines",
          margin: [0, 8, 0, 8],
          ...(pageBreak ? { pageBreak } : {}),
        });
        cursor += run;
      } else {
        const cells = lineCells(lines[cursor]);
        const cell = cells[0];
        const previous = lines[cursor - 1];
        const gap = previous ? Math.max(0, lines[cursor].y - (previous.y + previous.height)) : 0;
        content.push({
          text: cells.map((item) => item.text.trim()).join("  "),
          fontSize: clampSize(cell?.fontSize || 11),
          bold: cells.some((item) => item.bold),
          alignment: cell ? alignment(cell, page.width) : "left",
          margin: [0, Math.min(24, Math.round(gap)), 0, 0],
          ...(pageBreak ? { pageBreak } : {}),
        });
        cursor += 1;
      }
      blockIndex += 1;
    }
  });

  if (missingImages) {
    warnings.push("Logos and embedded images are preserved only when the PDF exposes them as extractable images. Compare the original if the document contains artwork.");
  }

  const first = pages[0] ?? { width: 595, height: 842, glyphs: [], images: [] };
  const named = namedPage(first.width, first.height);
  const minX = Math.min(...pages.flatMap((page) => page.glyphs.map((glyph) => glyph.x)).filter(Number.isFinite), 48);
  const left = Math.max(20, Math.min(72, Math.round(minX)));
  return {
    definition: {
      pageSize: named.pageSize,
      pageOrientation: named.pageOrientation,
      pageMargins: [left, 36, left, 36],
      defaultStyle: { font: "Roboto", fontSize: 10, color: "#0f172a" },
      content,
    },
    warnings,
  };
}
