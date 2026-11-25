import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildChatHandoffSummary,
  buildFamilyHandoffSummary,
  buildLiveCallHandoffSummary,
} from './familyHandoff.ts';
import type { ScanResult } from '../types/safeai.ts';

test('buildFamilyHandoffSummary includes full original text and URL even on green scans', () => {
  const greenScan: ScanResult = {
    id: 'scan-green-1',
    sourceMode: 'text',
    alertLevel: 'green',
    scamType: 'Nội dung chưa thấy dấu hiệu lừa đảo',
    confidence: 'medium',
    summary: 'Nội dung trông hợp lý và chưa ghi nhận dấu hiệu thúc ép hoặc đòi thông tin nhạy cảm.',
    visualEvidence: [],
    extractedText: 'Chú Minh ơi chiều nay 5h con ghé nhà đưa tiền thuốc cho mẹ nhé, số mới của con là 0912345678.',
    extractedEntities: {
      urls: [],
      phones: ['0912345678'],
      bankAccounts: [],
      qrPayload: '',
    },
    actionSteps: ['Giữ thói quen kiểm tra lại thông tin trên ứng dụng chính thức.'],
    reply: 'Nội dung trông hợp lý.',
    createdAt: '2026-11-19T07:36:00.000Z',
  };

  const drafted = buildFamilyHandoffSummary(greenScan, 'Bác Minh');
  assert.match(drafted, /Bác Minh vừa kiểm tra tin nhắn/);
  assert.match(drafted, /Chú Minh ơi chiều nay 5h con ghé nhà đưa tiền thuốc/);
  assert.match(drafted, /0912345678/);
  assert.match(drafted, /Giữ thói quen kiểm tra lại thông tin/);
});

test('buildFamilyHandoffSummary includes userContext, VietQR, bankAccounts, and all evidence on image red scans', () => {
  const redImageScan: ScanResult = {
    id: 'scan-red-1',
    sourceMode: 'image',
    alertLevel: 'red',
    scamType: 'Giả danh Công an thu tiền qua VietQR',
    confidence: 'high',
    summary: 'Phát hiện lệnh triệu tập giả yêu cầu quét QR chuyển 500.000đ.',
    userContext: 'Có người gửi ảnh này qua Zalo bắt cô chuyển tiền bảo lãnh gấp',
    visualEvidence: [
      {
        category: 'Giả danh Công an',
        finding: 'Đe dọa bắt giữ và cấm nói với người nhà.',
        severity: 'high',
      },
    ],
    extractedText: 'GIẤY TRIỆU TẬP CÔNG AN. Quét mã nộp 500.000đ.',
    extractedEntities: {
      urls: ['https://bocongan-xacminh.xyz'],
      phones: ['02499990001'],
      bankAccounts: ['1029384756'],
      qrPayload: '000201010212...',
    },
    vietQr: {
      isVietQr: true,
      crcValid: true,
      pointOfInitiation: 'dynamic',
      bankBin: '970436',
      bankShortName: 'Vietcombank',
      bankFullName: 'Ngân hàng TMCP Ngoại thương Việt Nam',
      bankHotline: '1900 545 413',
      accountNumber: '1029384756',
      amount: 500000,
      amountFormatted: '500.000 đ',
      currencyCode: '704',
      purpose: 'NOP PHAT',
      isPersonalAccount: true,
      rawPayload: '000201...',
    },
    actionSteps: ['Không chuyển tiền', 'Gọi ngay con cháu xác minh'],
    reply: 'Dừng lại ngay.',
    createdAt: '2026-11-19T07:36:00.000Z',
  };

  const drafted = buildFamilyHandoffSummary(redImageScan, 'Cô Lan');
  assert.match(drafted, /Cô Lan vừa kiểm tra ảnh chụp \/ mã QR/);
  assert.match(drafted, /Có người gửi ảnh này qua Zalo bắt cô chuyển tiền bảo lãnh gấp/);
  assert.match(drafted, /GIẤY TRIỆU TẬP CÔNG AN/);
  assert.match(drafted, /Vietcombank/);
  assert.match(drafted, /1029384756/);
  assert.match(drafted, /500\.000 đ/);
  assert.match(drafted, /https:\/\/bocongan-xacminh\.xyz/);
  assert.match(drafted, /02499990001/);
  assert.match(drafted, /KHÔNG chuyển tiền, KHÔNG đọc OTP/);
});

test('buildChatHandoffSummary and buildLiveCallHandoffSummary preserve full question/transcript context', () => {
  const chatDraft = buildChatHandoffSummary({
    userText: 'Có số 0987654321 xưng bên điện lực dọa cắt điện nếu không đọc OTP',
    modelReply: 'Đây là thủ đoạn lừa đảo giả danh điện lực. Cụ không đọc OTP.',
    alertLevel: 'red',
    senderName: 'Ông Hùng',
    createdAt: '2026-11-19T07:36:00.000Z',
  });
  assert.match(chatDraft, /Ông Hùng/);
  assert.match(chatDraft, /0987654321/);
  assert.match(chatDraft, /thủ đoạn lừa đảo giả danh điện lực/);

  const callDraft = buildLiveCallHandoffSummary({
    transcriptLines: [
      { who: 'user', text: 'Alo công an bảo chuyển tiền vào tài khoản an toàn' },
    ],
    riskHeadline: 'CẢNH BÁO CUỘC GỌI NGUY HIỂM',
    triggers: ['Xưng danh Công an', 'Yêu cầu đọc mã OTP'],
    level: 'red',
    senderName: 'Bác Minh',
  });
  assert.match(callDraft, /Lá chắn cuộc gọi lạ/);
  assert.match(callDraft, /Alo công an bảo chuyển tiền/);
  assert.match(callDraft, /Yêu cầu đọc mã OTP/);
});
