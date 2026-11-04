declare module "pdfmake" {
  import type { Readable } from "node:stream";

  export default class PdfPrinter {
    constructor(fonts: Record<string, Record<string, string>>);
    createPdfKitDocument(definition: unknown): Readable & { end: () => void };
  }
}
