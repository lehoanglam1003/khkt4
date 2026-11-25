import fs from 'node:fs';
import path from 'node:path';
import { createWorker, type Worker } from 'tesseract.js';
import { readImageDimensionsFromBuffer, type OcrLineBox } from '../shared/speechUtils.ts';
import type { BoundingBox } from '../types/safeai.ts';

const TESSDATA_DIR = '/tmp/safeai-tessdata';
let workerPromise: Promise<Worker> | null = null;

function ensureLocalTrainedData(): string {
  fs.mkdirSync(TESSDATA_DIR, { recursive: true });
  const languages = ['vie', 'eng'];
  for (const lang of languages) {
    const dest = path.join(TESSDATA_DIR, `${lang}.traineddata.gz`);
    if (!fs.existsSync(dest)) {
      const src = path.resolve(
        process.cwd(),
        `node_modules/@tesseract.js-data/${lang}/4.0.0/${lang}.traineddata.gz`
      );
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
      }
    }
  }
  return TESSDATA_DIR;
}

async function getOcrWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const dir = ensureLocalTrainedData();
      return createWorker(['vie', 'eng'], 1, {
        langPath: dir,
        cachePath: dir,
      });
    })().catch((err) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

function normalizeOcrBbox(
  raw: { x0: number; y0: number; x1: number; y1: number },
  imgW: number,
  imgH: number
): BoundingBox | undefined {
  if (imgW <= 0 || imgH <= 0) return undefined;
  const x = Math.max(0, Math.min(980, Math.round((raw.x0 / imgW) * 1000)));
  const y = Math.max(0, Math.min(980, Math.round((raw.y0 / imgH) * 1000)));
  const w = Math.max(20, Math.min(1000 - x, Math.round(((raw.x1 - raw.x0) / imgW) * 1000)));
  const h = Math.max(20, Math.min(1000 - y, Math.round(((raw.y1 - raw.y0) / imgH) * 1000)));
  return { x, y, w, h };
}

export async function extractTextAndLinesFromImageBuffer(
  buffer: Buffer,
  widthHint?: number,
  heightHint?: number
): Promise<{ text: string; lines: OcrLineBox[] }> {
  const worker = await getOcrWorker();
  const result = await worker.recognize(buffer, {}, { blocks: true });
  const rawText = (result.data.text || '').replace(/\n{3,}/g, '\n\n').trim();

  const headerDims = readImageDimensionsFromBuffer(buffer);
  const rawLines =
    result.data.blocks?.flatMap((b) => b.paragraphs?.flatMap((p) => p.lines ?? []) ?? []) ?? [];

  const maxLineX = rawLines.reduce((m, l) => Math.max(m, l.bbox?.x1 ?? 0), 0);
  const maxLineY = rawLines.reduce((m, l) => Math.max(m, l.bbox?.y1 ?? 0), 0);
  const imgW =
    Number(widthHint) > 0
      ? Number(widthHint)
      : headerDims?.width || Math.max(maxLineX + 20, 1);
  const imgH =
    Number(heightHint) > 0
      ? Number(heightHint)
      : headerDims?.height || Math.max(maxLineY + 20, 1);

  const lines: OcrLineBox[] = rawLines
    .map((line) => ({
      text: line.text.trim(),
      bbox: line.bbox ? normalizeOcrBbox(line.bbox, imgW, imgH) : undefined,
    }))
    .filter((l) => l.text.length > 0);

  return { text: rawText, lines };
}
