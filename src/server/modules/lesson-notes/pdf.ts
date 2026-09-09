import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { textBidi } from "bidi-shaper/pdfkit";

const FONT_REGULAR = path.join(process.cwd(), "src/fonts/Vazirmatn-Regular.ttf");
const FONT_BOLD = path.join(process.cwd(), "src/fonts/Vazirmatn-Bold.ttf");

function assertFonts() {
  if (!fs.existsSync(FONT_REGULAR) || !fs.existsSync(FONT_BOLD)) {
    throw new Error("فونت وزیرمتن برای تولید PDF یافت نشد.");
  }
}

type PdfKitDoc = Parameters<typeof textBidi>[0];

/** تولید PDF فارسی RTL با فونت Vazirmatn */
export async function buildLessonNotePdf(opts: {
  lessonTitle: string;
  body: string;
}): Promise<Buffer> {
  assertFonts();

  const title = opts.lessonTitle.trim() || "جزوه درس";
  const body = opts.body.trim() || "جزوه‌ای نوشته نشده است.";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 48, right: 48 },
      info: {
        Title: title,
        Author: "صفانور",
      },
    });
    const pdf = doc as unknown as PdfKitDoc;

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.registerFont("Vazirmatn", FONT_REGULAR);
    doc.registerFont("Vazirmatn-Bold", FONT_BOLD);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc.font("Vazirmatn-Bold").fontSize(16).fillColor("#111827");
    textBidi(pdf, title, {
      align: "right",
      width: pageWidth,
      bidi: { direction: "rtl" },
    });

    doc.moveDown(0.6);
    doc
      .moveTo(doc.page.margins.left, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor("#E5E7EB")
      .lineWidth(1)
      .stroke();
    doc.moveDown(0.8);

    doc.font("Vazirmatn").fontSize(12).fillColor("#1F2937");
    const paragraphs = body.split(/\n/);
    for (const paragraph of paragraphs) {
      const line = paragraph.length === 0 ? " " : paragraph;
      textBidi(pdf, line, {
        align: "right",
        width: pageWidth,
        lineGap: 6,
        bidi: { direction: "rtl" },
      });
      if (paragraph.length === 0) doc.moveDown(0.35);
    }

    doc.end();
  });
}
