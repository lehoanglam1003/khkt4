import { VIETNAM_BANKS, type VietnamBankMeta } from './vietqrParser.ts';
import type { ScanResult } from '../types/safeai.ts';

export interface RecoveryChecklistStep {
  id: string;
  title: string;
  detail: string;
  urgent: boolean;
}

export const GOLDEN_HOUR_CHECKLIST: RecoveryChecklistStep[] = [
  {
    id: 'lock-bank',
    title: '1. Khóa khẩn cấp tài khoản & thẻ ngân hàng',
    detail:
      'Gọi ngay tổng đài chính thức 24/7 của ngân hàng bên dưới hoặc mở app ngân hàng tự bấm "Khóa thẻ / Tạm khóa tài khoản" ngay lập tức.',
    urgent: true,
  },
  {
    id: 'cut-network',
    title: '2. Ngắt Wi-Fi / 4G ngay nếu lỡ bấm link lạ hoặc cài app',
    detail:
      'Kéo thanh thông báo từ trên xuống, bật "Chế độ máy bay" hoặc tắt Wi-Fi & Dữ liệu di động để chặn kẻ gian điều khiển màn hình từ xa.',
    urgent: true,
  },
  {
    id: 'remove-apk-accessibility',
    title: '3. Gỡ quyền Hỗ trợ tiếp cận (Accessibility) & xóa tệp .apk lạ',
    detail:
      'Vào Cài đặt điện thoại -> Hỗ trợ tiếp cận (Accessibility) -> Tắt các ứng dụng lạ không phải của Google/Samsung; sau đó vào Quản lý ứng dụng để Gỡ cài đặt.',
    urgent: true,
  },
  {
    id: 'call-family-police',
    title: '4. Giữ bằng chứng & báo Công an phường/xã gần nhất (hoặc gọi 113)',
    detail:
      'Chụp lại lịch sử chuyển khoản, số tài khoản nhận, số điện thoại đối tượng. Bấm nút "Sao chép biên bản trình báo" bên dưới để gửi cho con cháu hoặc mang ra Công an.',
    urgent: false,
  },
];

export function detectMentionedBanks(
  scan: ScanResult | null,
  extraText = ''
): VietnamBankMeta[] {
  const matched: VietnamBankMeta[] = [];
  const seenBins = new Set<string>();

  if (scan?.vietQr?.bankBin) {
    const exact = VIETNAM_BANKS.find((b) => b.bin === scan.vietQr?.bankBin);
    if (exact) {
      matched.push(exact);
      seenBins.add(exact.bin);
    }
  }

  const corpus = [
    scan?.receiptForensics?.detectedBank ?? '',
    scan?.extractedText ?? '',
    scan?.summary ?? '',
    extraText,
  ]
    .join(' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  for (const bank of VIETNAM_BANKS) {
    if (seenBins.has(bank.bin)) continue;
    if (bank.keywords.some((kw) => corpus.includes(kw))) {
      matched.push(bank);
      seenBins.add(bank.bin);
    }
  }

  return matched;
}

export function buildIncidentReportText(
  scan: ScanResult | null,
  victimNotes = '',
  amountLost = ''
): string {
  const nowStr = new Date().toLocaleString('vi-VN');
  const lines: string[] = [
    '=== ĐƠN TÓM TẮT TRÌNH BÁO SỰ CỐ LỪA ĐẢO (SAFEAI) ===',
    `Thời điểm ghi nhận: ${nowStr}`,
    `Phân loại nghi vấn: ${scan?.scamType || 'Nghi vấn lừa đảo chuyển tiền / đường link độc hại'}`,
  ];

  if (amountLost.trim()) {
    lines.push(`Số tiền liên quan: ${amountLost.trim()}`);
  }
  if (scan?.vietQr) {
    lines.push(
      `Thông tin VietQR giải mã: ${scan.vietQr.bankShortName} - STK ${scan.vietQr.accountNumber || 'chưa rõ'}${
        scan.vietQr.amountFormatted ? ` - Số tiền ${scan.vietQr.amountFormatted}` : ''
      }`
    );
  }
  if (scan?.extractedEntities.bankAccounts.length) {
    lines.push(`Số tài khoản liên quan: ${scan.extractedEntities.bankAccounts.join(', ')}`);
  }
  if (scan?.extractedEntities.phones.length) {
    lines.push(`Số điện thoại đối tượng: ${scan.extractedEntities.phones.join(', ')}`);
  }
  if (scan?.extractedEntities.urls.length) {
    lines.push(`Đường link / tên miền: ${scan.extractedEntities.urls.join(', ')}`);
  }
  if (scan?.summary) {
    lines.push(`Tóm tắt dấu hiệu: ${scan.summary}`);
  }
  if (victimNotes.trim()) {
    lines.push(`Diễn biến người trình báo cung cấp: ${victimNotes.trim()}`);
  }
  if (scan?.extractedText) {
    lines.push(`Nội dung trích xuất (rút gọn): ${scan.extractedText.slice(0, 400)}`);
  }
  lines.push('Khuyến nghị: Yêu cầu ngân hàng hỗ trợ tra soát/phong tỏa khẩn cấp và trình báo cơ quan Công an gần nhất.');
  return lines.join('\n');
}
