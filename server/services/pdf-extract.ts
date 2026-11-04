import { MAX_PDF_PAGES } from "../../shared/types";
import type { Glyph, PageImage, PageLayout } from "./layout";
import { AppError, assertPdf, mapPdfError } from "./errors";

interface PdfItem {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
}

interface PdfPage {
  getViewport: (input: { scale: number }) => { width: number; height: number };
  getTextContent: () => Promise<{ items: PdfItem[] }>;
  getOperatorList: () => Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  objs: { get: (name: string, callback: (obj: unknown) => void) => void };
  render: (input: unknown) => { promise: Promise<void> };
}

interface PdfDocument {
  numPages: number;
  getPage: (page: number) => Promise<PdfPage>;
  destroy: () => Promise<void>;
}

async function loadDocument(buffer: Buffer): Promise<PdfDocument> {
  assertPdf(buffer);
  const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as {
    getDocument: (src: unknown) => { promise: Promise<PdfDocument> };
    OPS: { paintImageXObject: number };
  };
  try {
    return await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0,
    }).promise;
  } catch (error) {
    throw mapPdfError(error);
  }
}

function glyphsFromItems(items: PdfItem[], pageHeight: number): Glyph[] {
  const glyphs: Glyph[] = [];
  for (const item of items) {
    if (!item.str?.trim() || !item.transform) continue;
    const transform = item.transform;
    const fontSize = Math.hypot(transform[2] || 0, transform[3] || 0) || Math.abs(transform[0] || 0) || item.height || 11;
    glyphs.push({
      text: item.str,
      x: transform[4] || 0,
      y: pageHeight - (transform[5] || 0) - fontSize,
      width: item.width || item.str.length * fontSize * 0.45,
      height: item.height || fontSize,
      fontSize,
      fontName: item.fontName || "",
    });
  }
  return glyphs;
}

async function readImages(page: PdfPage): Promise<PageImage[]> {
  const images: PageImage[] = [];
  try {
    const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as { OPS: { paintImageXObject: number } };
    const canvasPkg = await import("@napi-rs/canvas");
    const ops = await page.getOperatorList();
    const seen = new Set<string>();
    for (let index = 0; index < ops.fnArray.length; index += 1) {
      if (ops.fnArray[index] !== pdfjs.OPS.paintImageXObject) continue;
      const name = String(ops.argsArray[index]?.[0] ?? "");
      if (!name || seen.has(name)) continue;
      seen.add(name);
      const obj = await new Promise<Record<string, unknown> | null>((resolve) => {
        try {
          page.objs.get(name, (value) => resolve((value ?? null) as Record<string, unknown> | null));
        } catch {
          resolve(null);
        }
      });
      if (!obj || !(obj.data instanceof Uint8ClampedArray) || typeof obj.width !== "number" || typeof obj.height !== "number") {
        continue;
      }
      try {
        const canvas = canvasPkg.createCanvas(obj.width, obj.height);
        const context = canvas.getContext("2d");
        const imageData = new canvasPkg.ImageData(new Uint8ClampedArray(obj.data), obj.width, obj.height);
        context.putImageData(imageData, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        if (dataUrl.startsWith("data:image/png")) images.push({ dataUrl, width: obj.width, height: obj.height });
      } catch {
        /* raw PDF image data is not always RGBA */
      }
      if (images.length >= 4) break;
    }
  } catch {
    return images;
  }
  return images;
}

async function ocrPage(page: PdfPage): Promise<Glyph[]> {
  try {
    const canvasPkg = await import("@napi-rs/canvas");
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = canvasPkg.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const context = canvas.getContext("2d");
    const factory = {
      create(w: number, h: number) {
        const next = canvasPkg.createCanvas(w, h);
        return { canvas: next, context: next.getContext("2d") };
      },
      reset(pair: { canvas: { width: number; height: number } }, w: number, h: number) {
        pair.canvas.width = w;
        pair.canvas.height = h;
      },
      destroy(pair: { canvas: { width: number; height: number } }) {
        pair.canvas.width = 0;
        pair.canvas.height = 0;
      },
    };
    await page.render({ canvasContext: context, viewport, canvasFactory: factory }).promise;
    const png = canvas.toBuffer("image/png");
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    try {
      const result = await worker.recognize(png);
      const data = result.data as {
        words?: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[];
      };
      return (data.words ?? [])
        .filter((word) => word.text.trim())
        .map((word) => ({
          text: `${word.text} `,
          x: word.bbox.x0 / scale,
          y: word.bbox.y0 / scale,
          width: Math.max(1, (word.bbox.x1 - word.bbox.x0) / scale),
          height: Math.max(1, (word.bbox.y1 - word.bbox.y0) / scale),
          fontSize: Math.max(8, (word.bbox.y1 - word.bbox.y0) / scale),
          fontName: "",
        }));
    } finally {
      await worker.terminate();
    }
  } catch {
    return [];
  }
}

async function readPage(page: PdfPage, pageNumber: number): Promise<PageLayout> {
  const viewport = page.getViewport({ scale: 1 });
  const text = await page.getTextContent();
  let glyphs = glyphsFromItems(text.items, viewport.height);
  const letters = glyphs.map((glyph) => glyph.text).join("").replace(/\s/g, "").length;
  if (letters < 15 && pageNumber <= 8) {
    const recognized = await ocrPage(page);
    if (recognized.length) glyphs = recognized;
  }
  const images = letters < 15 ? [] : await readImages(page);
  return { width: viewport.width, height: viewport.height, glyphs, images };
}

export async function inspectPdf(buffer: Buffer): Promise<{ pageCount: number }> {
  const doc = await loadDocument(buffer);
  const pageCount = doc.numPages;
  if (pageCount > MAX_PDF_PAGES) {
    await doc.destroy();
    throw new AppError(400, "PDF_TOO_LARGE", `PDFs are limited to ${MAX_PDF_PAGES} pages.`);
  }
  if (pageCount < 1) {
    await doc.destroy();
    throw new AppError(400, "PDF_INVALID", "This PDF does not contain any pages.");
  }
  await doc.destroy();
  return { pageCount };
}

export async function extractPdf(buffer: Buffer): Promise<{ pages: PageLayout[]; pageCount: number }> {
  const doc = await loadDocument(buffer);
  if (doc.numPages > MAX_PDF_PAGES) {
    await doc.destroy();
    throw new AppError(400, "PDF_TOO_LARGE", `PDFs are limited to ${MAX_PDF_PAGES} pages.`);
  }
  const pages: PageLayout[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    pages.push(await readPage(await doc.getPage(pageNumber), pageNumber));
  }
  await doc.destroy();
  const letters = pages.reduce((sum, page) => sum + page.glyphs.map((glyph) => glyph.text).join("").replace(/\s/g, "").length, 0);
  if (letters < 8) {
    throw new AppError(
      422,
      "SCANNED_PDF",
      "This PDF has no text layer and OCR could not read it. Upload a text-based PDF, configure an AI vision provider, or start from PDFMake JSON.",
    );
  }
  return { pages, pageCount: doc.numPages };
}
