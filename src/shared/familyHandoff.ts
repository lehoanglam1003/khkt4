import type { AlertLevel, ScanResult } from '../types/safeai.ts';

function formatAlertLabel(level: AlertLevel): string {
  if (level === 'red') return 'NGUY HIỂM (ĐỎ)';
  if (level === 'orange') return 'ĐÁNG NGỜ (CAM)';
  return 'AN TOÀN (XANH)';
}

function formatSourceMode(mode: ScanResult['sourceMode']): string {
  if (mode === 'image') return 'ảnh chụp / mã QR';
  if (mode === 'audio') return 'đoạn ghi âm cuộc gọi';
  return 'tin nhắn / nội dung chữ';
}

function formatTimeLabel(iso?: string): string {
  try {
    const date = iso ? new Date(iso) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
}

function excerptText(value: string, maxLen = 600): string {
  const normalized = (value || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen).trimEnd()}...`;
}

export function buildFamilyHandoffSummary(scan: ScanResult, senderName = 'Bố/Mẹ'): string {
  const who = senderName.trim() || 'Bố/Mẹ';
  const timeStr = formatTimeLabel(scan.createdAt);
  const whenPart = timeStr ? ` lúc ${timeStr}` : '';
  const modeLabel = formatSourceMode(scan.sourceMode);

  const lines: string[] = [
    `[SafeAI] ${who} vừa kiểm tra ${modeLabel}${whenPart} (${formatAlertLabel(scan.alertLevel)} — ${scan.scamType}) và nhờ con cháu xem giúp:`,
    '',
    '1. NỘI DUNG BỐ/MẸ ĐÃ NHẬN / GỬI KIỂM TRA:',
  ];

  const userNote = excerptText(scan.userContext ?? '', 300);
  const extracted = excerptText(scan.extractedText ?? '', 600);
  if (userNote) {
    lines.push(`- Hoàn cảnh/lời kể của ${who}: "${userNote}"`);
  }
  if (extracted && extracted !== userNote) {
    lines.push(`- Nguyên văn nội dung:\n"${extracted}"`);
  } else if (!userNote) {
    lines.push('- (Chưa đọc được chữ rõ trong ảnh; xem thông tin mã QR và dấu hiệu bên dưới)');
  }

  lines.push(
    '',
    '2. NHẬN XÉT CỦA SAFEAI:',
    `- Đánh giá: ${formatAlertLabel(scan.alertLevel)} (${scan.scamType})`,
    `- Tóm tắt: ${scan.summary}`
  );

  const analysisDetails: string[] = [];
  if (scan.impersonationWarning) {
    analysisDetails.push(`- Cảnh báo đối chiếu danh bạ: ${scan.impersonationWarning}`);
  }
  if (scan.vietQr) {
    const qrParts = [
      `Ngân hàng ${scan.vietQr.bankShortName}`,
      `STK ${scan.vietQr.accountNumber || 'chưa rõ'}`,
      scan.vietQr.amountFormatted ? `Số tiền ${scan.vietQr.amountFormatted}` : '',
      scan.vietQr.purpose ? `Nội dung CK "${scan.vietQr.purpose}"` : '',
      scan.vietQr.crcValid ? 'CRC hợp lệ' : 'CRC không khớp',
    ].filter(Boolean);
    analysisDetails.push(`- Mã VietQR giải mã: ${qrParts.join(' · ')}`);
  }
  if (scan.receiptForensics?.isReceiptLike && scan.receiptForensics.anomalies.length > 0) {
    analysisDetails.push(`- Kiểm tra biên lai: ${scan.receiptForensics.anomalies.join('; ')}`);
  }
  for (const [idx, ev] of scan.visualEvidence.slice(0, 5).entries()) {
    analysisDetails.push(`- Dấu hiệu ${idx + 1} (${ev.category}): ${ev.finding}`);
  }
  if (scan.extractedEntities.phones.length > 0) {
    analysisDetails.push(`- Số điện thoại liên quan: ${scan.extractedEntities.phones.join(', ')}`);
  }
  if (scan.extractedEntities.urls.length > 0) {
    analysisDetails.push(`- Đường link trích xuất: ${scan.extractedEntities.urls.join(', ')}`);
  }
  if (scan.extractedEntities.bankAccounts.length > 0) {
    analysisDetails.push(`- Số tài khoản liên quan: ${scan.extractedEntities.bankAccounts.join(', ')}`);
  }
  if (scan.extractedEntities.qrPayload && !scan.vietQr) {
    analysisDetails.push(`- Dữ liệu mã QR: ${excerptText(scan.extractedEntities.qrPayload, 220)}`);
  }

  if (analysisDetails.length > 0) {
    lines.push('', '3. PHÂN TÍCH & THÔNG TIN TRÍCH XUẤT:', ...analysisDetails);
  }

  lines.push('', '4. KHUYẾN NGHỊ XỬ LÝ:');
  if (scan.actionSteps.length > 0) {
    for (const [idx, step] of scan.actionSteps.slice(0, 4).entries()) {
      lines.push(`${idx + 1}. ${step}`);
    }
  }
  if (scan.alertLevel === 'red') {
    lines.push(
      `⚠️ Nhờ con cháu gọi ngay cho ${who} để kiểm tra sự việc và nhắc ${who} KHÔNG chuyển tiền, KHÔNG đọc OTP!`
    );
  } else if (scan.alertLevel === 'orange') {
    lines.push(
      `⚠️ Nhờ con cháu đọc kỹ nội dung trên và xác minh lại giúp ${who} trước khi ${who} làm theo.`
    );
  } else {
    lines.push(
      `ℹ️ SafeAI chưa thấy dấu hiệu lừa đảo rõ ràng, nhưng vẫn gửi đầy đủ nội dung trên để con cháu nắm rõ vụ việc và kiểm tra lại giúp ${who} cho yên tâm.`
    );
  }

  return lines.join('\n');
}

export function buildChatHandoffSummary(params: {
  userText: string;
  modelReply: string;
  alertLevel: AlertLevel;
  senderName?: string;
  createdAt?: string;
}): string {
  const who = (params.senderName || 'Bố/Mẹ').trim() || 'Bố/Mẹ';
  const timeStr = formatTimeLabel(params.createdAt);
  const whenPart = timeStr ? ` lúc ${timeStr}` : '';

  return [
    `[SafeAI] ${who} vừa hỏi Trợ lý An toàn${whenPart} và nhờ con cháu xem giúp:`,
    '',
    `1. MỨC ĐỘ ĐÁNH GIÁ: ${formatAlertLabel(params.alertLevel)}`,
    '',
    `2. NỘI DUNG ${who.toUpperCase()} KỂ / HỎI:`,
    `"${excerptText(params.userText, 500)}"`,
    '',
    `3. PHÂN TÍCH & TƯ VẤN CỦA SAFEAI:`,
    excerptText(params.modelReply, 700),
    '',
    `Nhờ con cháu xem qua tình huống trên và gọi trao đổi lại với ${who} cho yên tâm nhé.`,
  ].join('\n');
}

export function buildLiveCallHandoffSummary(params: {
  transcriptLines: { who: 'user' | 'ai'; text: string }[];
  riskHeadline: string;
  triggers: string[];
  level: AlertLevel;
  senderName?: string;
}): string {
  const who = (params.senderName || 'Bố/Mẹ').trim() || 'Bố/Mẹ';
  const timeStr = formatTimeLabel();
  const whenPart = timeStr ? ` lúc ${timeStr}` : '';
  const transcriptText = params.transcriptLines
    .map((line) => `${line.who === 'user' ? 'Ghi nhận cuộc gọi' : 'SafeAI'}: ${line.text}`)
    .join('\n');

  const lines = [
    `[SafeAI] ${who} vừa bật Lá chắn cuộc gọi lạ${whenPart} và cần con cháu hỗ trợ:`,
    '',
    `1. CẢNH BÁO: ${formatAlertLabel(params.level)} — ${params.riskHeadline}`,
  ];

  if (params.triggers.length > 0) {
    lines.push(`- Dấu hiệu phát hiện: ${params.triggers.join('; ')}`);
  }
  if (transcriptText.trim()) {
    lines.push('', '2. NỘI DUNG CUỘC GỌI GHI NHẬN ĐƯỢC:', excerptText(transcriptText, 700));
  }
  lines.push('', `⚠️ Nhờ con cháu gọi ngay cho ${who} để kiểm tra xem ai vừa gọi tới và hỗ trợ kịp thời!`);
  return lines.join('\n');
}
