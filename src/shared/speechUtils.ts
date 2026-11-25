import type { BoundingBox, VisualEvidenceItem } from '../types/safeai.ts';

/**
 * Splits Vietnamese text into clean <= maxLen chunks along sentence/clause/word boundaries
 * so TTS engines (both fallback MP3 TTS and browser speechSynthesis) never truncate mid-word.
 */
export function splitVietnameseSpeechChunks(text: string, maxLen = 175): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  if (normalized.length <= maxLen) return [normalized];

  const sentences = normalized
    .split(/(?<=[.!?;:\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  const pushWordSplit = (longPart: string) => {
    const words = longPart.split(/\s+/);
    let buf = '';
    for (const w of words) {
      if (!buf) {
        buf = w.slice(0, maxLen);
      } else if (buf.length + 1 + w.length <= maxLen) {
        buf = `${buf} ${w}`;
      } else {
        chunks.push(buf);
        buf = w.slice(0, maxLen);
      }
    }
    if (buf) chunks.push(buf);
  };

  for (const sentence of sentences) {
    if (sentence.length > maxLen) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      const subClauses = sentence.split(/(?<=,)\s+/);
      for (const clause of subClauses) {
        if (clause.length > maxLen) {
          if (current) {
            chunks.push(current);
            current = '';
          }
          pushWordSplit(clause);
        } else if (!current) {
          current = clause;
        } else if (current.length + 1 + clause.length <= maxLen) {
          current = `${current} ${clause}`;
        } else {
          chunks.push(current);
          current = clause;
        }
      }
      continue;
    }

    if (!current) {
      current = sentence;
    } else if (current.length + 1 + sentence.length <= maxLen) {
      current = `${current} ${sentence}`;
    } else {
      chunks.push(current);
      current = sentence;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

/**
 * Reads width/height directly from PNG, JPEG, or WebP headers without native image libraries.
 */
export function readImageDimensionsFromBuffer(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 24) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width@16, height@20 (big-endian uint32)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const width = view.getUint32(16, false);
    const height = view.getUint32(20, false);
    if (width > 0 && height > 0) return { width, height };
  }

  // JPEG: FF D8 ... SOFn (C0..C3, C5..C7, C9..CB, CD..CF)
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd8)) {
        i += 2;
        continue;
      }
      const segLen = (buf[i + 2] << 8) | buf[i + 3];
      if (segLen < 2 || i + 2 + segLen > buf.length) break;
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof && segLen >= 7) {
        const height = (buf[i + 5] << 8) | buf[i + 6];
        const width = (buf[i + 7] << 8) | buf[i + 8];
        if (width > 0 && height > 0) return { width, height };
      }
      i += 2 + segLen;
    }
  }

  return null;
}

export interface OcrLineBox {
  text: string;
  bbox?: BoundingBox;
}

const SUSPICIOUS_LINE_PATTERNS = [
  /otp|mat khau|mật khẩu|pin|sinh trac|sinh trắc|cccd|khoa tai khoan|khóa tài khoản/i,
  /https?:\/\/|bit\.ly|tinyurl|\.xyz|\.top|\.vip|\.apk/i,
  /phi xac minh|phí xác minh|phi giai ngan|phí giải ngân|nap them|nạp thêm|chuyen khoan|stk/i,
  /cong an|công an|toa an|tòa án|vien kiem sat|viện kiểm sát|trung thuong|trúng thưởng/i,
];

/**
 * Matches detected visualEvidence items against OCR lines so uploaded screenshots
 * get real interactive 0..1000 bounding boxes even in offline OCR mode.
 */
export function attachOcrLineBoundingBoxes(
  evidence: VisualEvidenceItem[],
  lines: OcrLineBox[]
): VisualEvidenceItem[] {
  const validLines = lines.filter((l) => l.bbox && l.text.trim().length > 2);
  if (validLines.length === 0) return evidence;

  const findLineForPattern = (pattern: RegExp): BoundingBox | undefined =>
    validLines.find((l) => pattern.test(l.text))?.bbox;

  return evidence.map((item) => {
    if (item.bbox) return item;
    const cat = item.category.toLowerCase();
    const finding = item.finding.toLowerCase();

    if (cat.includes('liên kết') || cat.includes('link') || finding.includes('http')) {
      const matched = findLineForPattern(/https?:\/\/|www\.|bit\.ly|tinyurl|\.xyz|\.top|\.apk/i);
      if (matched) return { ...item, bbox: matched };
    }
    if (cat.includes('biên lai') || cat.includes('nạp') || finding.includes('phí')) {
      const matched = findLineForPattern(/phi|phí|giai ngan|giải ngân|nap|nạp|vnd|stk|chuyen/i);
      if (matched) return { ...item, bbox: matched };
    }
    if (cat.includes('ngôn từ') || cat.includes('thúc ép') || finding.includes('otp')) {
      const matched = findLineForPattern(SUSPICIOUS_LINE_PATTERNS[0]);
      if (matched) return { ...item, bbox: matched };
    }
    if (cat.includes('mạo danh') || cat.includes('danh bạ')) {
      const matched = findLineForPattern(/0\d{8,10}|\+84\d{8,10}|cong an|ngan hang|ngân hàng/i);
      if (matched) return { ...item, bbox: matched };
    }

    const riskyFallback = validLines.find((l) =>
      SUSPICIOUS_LINE_PATTERNS.some((re) => re.test(l.text))
    );
    return riskyFallback?.bbox ? { ...item, bbox: riskyFallback.bbox } : item;
  });
}
