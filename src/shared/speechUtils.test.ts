import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachOcrLineBoundingBoxes,
  readImageDimensionsFromBuffer,
  splitVietnameseSpeechChunks,
} from './speechUtils.ts';

test('splitVietnameseSpeechChunks splits long Vietnamese paragraphs cleanly under maxLen', () => {
  const longText =
    'Cảnh báo Đỏ: Đây là tin nhắn giả mạo ngân hàng yêu cầu nhập mã OTP khẩn cấp. Cụ tuyệt đối không bấm vào đường link lạ, không chuyển tiền và hãy gọi ngay cho con cháu để kiểm tra lại thông tin này nhé!';
  const chunks = splitVietnameseSpeechChunks(longText, 90);
  assert.ok(chunks.length >= 2);
  for (const c of chunks) {
    assert.ok(c.length <= 90, `Chunk exceeded maxLen: ${c.length}`);
  }
  assert.equal(chunks.join(' '), longText);
});

test('readImageDimensionsFromBuffer parses PNG IHDR dimensions accurately', () => {
  // Minimal 24-byte PNG signature + IHDR header with 720x960
  const buf = new Uint8Array(24);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(buf.buffer);
  view.setUint32(16, 720, false);
  view.setUint32(20, 960, false);
  assert.deepEqual(readImageDimensionsFromBuffer(buf), { width: 720, height: 960 });
});

test('attachOcrLineBoundingBoxes maps OCR line coordinates to evidence items without bboxes', () => {
  const evidence = [
    {
      category: 'Liên kết / QR nguy hiểm',
      finding: 'Phát hiện link giả mạo https://vietcombank-xacthuc.xyz/otp',
      severity: 'high' as const,
    },
  ];
  const lines = [
    {
      text: 'Truy cập https://vietcombank-xacthuc.xyz/otp ngay',
      bbox: { x: 50, y: 300, w: 800, h: 60 },
    },
  ];
  const mapped = attachOcrLineBoundingBoxes(evidence, lines);
  assert.deepEqual(mapped[0].bbox, { x: 50, y: 300, w: 800, h: 60 });
});
