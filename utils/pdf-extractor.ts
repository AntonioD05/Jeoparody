/**
 * Client-side PDF text extraction using pdfjs-dist
 * This avoids the Vercel 4.5MB request body limit by extracting text in the browser
 */

const MIN_LINE_LENGTH = 25;
const TARGET_WORDS = 1200;
const MIN_WORDS = 1000;
const MAX_WORDS = 1500;

const cleanText = (rawText: string): string => {
  const lines = rawText.split(/\r?\n/);
  const cleanedLines = lines
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length >= MIN_LINE_LENGTH);

  const joined = cleanedLines.join("\n");
  return joined.replace(/\n{3,}/g, "\n\n").trim();
};

const chunkText = (text: string): string[] => {
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

export type ExtractionResult = {
  chunks: string[];
  meta: {
    pages: number;
    chunkCount: number;
  };
};

export async function extractPdfText(file: File): Promise<ExtractionResult> {
  // Dynamically import pdfjs-dist for client-side use
  const pdfjs = await import("pdfjs-dist");
  
  // Set up the worker
  pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }

  const rawText = pages.join("\n");

  if (!rawText.trim()) {
    throw new Error("PDF extraction returned empty text. The PDF may be image-based or corrupted.");
  }

  const cleaned = cleanText(rawText);
  const chunks = chunkText(cleaned);

  return {
    chunks,
    meta: {
      pages: pdf.numPages,
      chunkCount: chunks.length,
    },
  };
}
