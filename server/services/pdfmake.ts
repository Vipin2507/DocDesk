import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PdfPrinter from "pdfmake";
import { stripInternal } from "../../shared/document";
import type { DocumentDefinition } from "../../shared/types";

const fontsDir = fs.existsSync(path.resolve(process.cwd(), "server/fonts"))
  ? path.resolve(process.cwd(), "server/fonts")
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fonts");

const fonts = {
  Roboto: {
    normal: path.join(fontsDir, "Roboto-Regular.ttf"),
    bold: path.join(fontsDir, "Roboto-Medium.ttf"),
    italics: path.join(fontsDir, "Roboto-Italic.ttf"),
    bolditalics: path.join(fontsDir, "Roboto-MediumItalic.ttf"),
  },
};

let printer: PdfPrinter | null = null;

function getPrinter(): PdfPrinter {
  for (const file of Object.values(fonts.Roboto)) {
    if (!fs.existsSync(file)) {
      throw new Error(`Font file is missing: ${path.basename(file)}`);
    }
  }
  printer ??= new PdfPrinter(fonts);
  return printer;
}

export async function renderPdf(definition: DocumentDefinition): Promise<Buffer> {
  const printable = stripInternal(definition) as DocumentDefinition;
  printable.defaultStyle = { fontSize: 10, ...(printable.defaultStyle ?? {}), font: "Roboto" };
  printable.info = { ...(printable.info ?? {}), Producer: "Buildesk Document Studio" };
  const document = getPrinter().createPdfKitDocument(printable as never);
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
    document.end();
  });
}
