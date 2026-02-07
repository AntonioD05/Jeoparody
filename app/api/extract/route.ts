import type { NextRequest } from "next/server";
import pdfParse from "pdf-parse";

export const runtime = "nodejs";

const MIN_LINE_LENGTH = 25;
const TARGET_WORDS = 1200;
const MIN_WORDS = 1000;
const MAX_WORDS = 1500;

const cleanText = (rawText: string) => {
  const lines = rawText.split(/\r?\n/);
  const cleanedLines = lines
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length >= MIN_LINE_LENGTH);

  const joined = cleanedLines.join("\n");
  return joined.replace(/\n{3,}/g, "\n\n").trim();
};

const chunkText = (text: string) => {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  let index = 0;
  while (index < words.length) {
    const remaining = words.length - index;
    let size = Math.min(TARGET_WORDS, remaining);

    if (remaining < MIN_WORDS && chunks.length > 0) {
      chunks[chunks.length - 1] = `${chunks[chunks.length - 1]} ${words
        .slice(index)
        .join(" ")}`.trim();
      break;
    }

    if (size > MAX_WORDS) {
      size = MAX_WORDS;
    }

    const slice = words.slice(index, index + size).join(" ");
    chunks.push(slice);
    index += size;
  }

  return chunks;
};

const extractWithPdfParse = async (buffer: Buffer) => {
  const data = await pdfParse(buffer);
  return { text: data.text ?? "", pages: data.numpages };
};

const extractWithPdfJs = async (buffer: Buffer) => {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }

  return { text: pages.join("\n"), pages: pdf.numPages };
};

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return Response.json(
        { error: "Missing PDF file in form-data field 'file'." },
        { status: 400 },
      );
    }

    const isPdfType =
      file.type === "application/pdf" ||
      file.name?.toLowerCase().endsWith(".pdf");

    if (!isPdfType) {
      return Response.json(
        { error: "Invalid file type. Please upload a PDF." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let extractedText = "";
    let pages: number | undefined;

    try {
      const result = await extractWithPdfParse(buffer);
      extractedText = result.text;
      pages = result.pages;
    } catch {
      const result = await extractWithPdfJs(buffer);
      extractedText = result.text;
      pages = result.pages;
    }

    if (!extractedText.trim()) {
      return Response.json(
        { error: "PDF extraction returned empty text." },
        { status: 500 },
      );
    }

    const cleaned = cleanText(extractedText);
    const chunks = chunkText(cleaned);

    return Response.json({
      chunks,
      meta: {
        pages,
        chunkCount: chunks.length,
      },
    });
  } catch (error) {
    console.error("PDF extraction error:", error);
    return Response.json(
      { error: "Failed to extract PDF text." },
      { status: 500 },
    );
  }
}
