import type { AlertLevel, TrustedContact, VietQrInfo } from '../types/safeai.ts';

export interface VietnamBankMeta {
  bin: string;
  shortName: string;
  fullName: string;
  hotline: string;
  keywords: string[];
}

export const VIETNAM_BANKS: VietnamBankMeta[] = [
  {
    bin: '970436',
    shortName: 'Vietcombank',
    fullName: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)',
    hotline: '1900 5454 13',
    keywords: ['vietcombank', 'vcb'],
  },
  {
    bin: '970418',
    shortName: 'BIDV',
    fullName: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam (BIDV)',
    hotline: '1900 9247',
    keywords: ['bidv'],
  },
  {
    bin: '970415',
    shortName: 'VietinBank',
    fullName: 'Ngân hàng TMCP Công thương Việt Nam (VietinBank)',
    hotline: '1900 5588 68',
    keywords: ['vietinbank', 'vietin'],
  },
  {
    bin: '970405',
    shortName: 'Agribank',
    fullName: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn (Agribank)',
    hotline: '1900 5588 18',
    keywords: ['agribank'],
  },
  {
    bin: '970407',
    shortName: 'Techcombank',
    fullName: 'Ngân hàng TMCP Kỹ thương Việt Nam (Techcombank)',
    hotline: '1800 5888 22',
    keywords: ['techcombank', 'tcb'],
  },
  {
    bin: '970422',
    shortName: 'MB Bank',
    fullName: 'Ngân hàng TMCP Quân đội (MB Bank)',
    hotline: '1900 5454 26',
    keywords: ['mbbank', 'mb bank', 'quan doi'],
  },
  {
    bin: '970416',
    shortName: 'ACB',
    fullName: 'Ngân hàng TMCP Á Châu (ACB)',
    hotline: '1900 5454 86',
    keywords: ['acb', 'a chau'],
  },
  {
    bin: '970432',
    shortName: 'VPBank',
    fullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng (VPBank)',
    hotline: '1900 5454 15',
    keywords: ['vpbank'],
  },
  {
    bin: '970423',
    shortName: 'TPBank',
    fullName: 'Ngân hàng TMCP Tiên Phong (TPBank)',
    hotline: '1900 5858 85',
    keywords: ['tpbank', 'tien phong'],
  },
  {
    bin: '970403',
    shortName: 'Sacombank',
    fullName: 'Ngân hàng TMCP Sài Gòn Thương Tín (Sacombank)',
    hotline: '1800 5858 88',
    keywords: ['sacombank'],
  },
  {
    bin: '970437',
    shortName: 'HDBank',
    fullName: 'Ngân hàng TMCP Phát triển TP.HCM (HDBank)',
    hotline: '1900 6060',
    keywords: ['hdbank'],
  },
  {
    bin: '970441',
    shortName: 'VIB',
    fullName: 'Ngân hàng TMCP Quốc tế Việt Nam (VIB)',
    hotline: '1800 8180',
    keywords: ['vib'],
  },
  {
    bin: '970443',
    shortName: 'SHB',
    fullName: 'Ngân hàng TMCP Sài Gòn - Hà Nội (SHB)',
    hotline: '1800 5888 56',
    keywords: ['shb'],
  },
  {
    bin: '970448',
    shortName: 'OCB',
    fullName: 'Ngân hàng TMCP Phương Đông (OCB)',
    hotline: '1800 6678',
    keywords: ['ocb', 'phuong dong'],
  },
  {
    bin: '970426',
    shortName: 'MSB',
    fullName: 'Ngân hàng TMCP Hàng Hải Việt Nam (MSB)',
    hotline: '1900 6083',
    keywords: ['msb', 'hang hai'],
  },
  {
    bin: '970440',
    shortName: 'SeABank',
    fullName: 'Ngân hàng TMCP Đông Nam Á (SeABank)',
    hotline: '1900 555 587',
    keywords: ['seabank'],
  },
  {
    bin: '970431',
    shortName: 'Eximbank',
    fullName: 'Ngân hàng TMCP Xuất Nhập Khẩu (Eximbank)',
    hotline: '1900 6655',
    keywords: ['eximbank'],
  },
  {
    bin: '970449',
    shortName: 'LPBank',
    fullName: 'Ngân hàng TMCP Lộc Phát Việt Nam (LPBank)',
    hotline: '1800 5777 58',
    keywords: ['lpbank', 'lienvietpostbank'],
  },
  {
    bin: '970428',
    shortName: 'Nam A Bank',
    fullName: 'Ngân hàng TMCP Nam Á (Nam A Bank)',
    hotline: '1900 6679',
    keywords: ['nam a bank', 'namabank'],
  },
  {
    bin: '971025',
    shortName: 'MoMo',
    fullName: 'Ví điện tử MoMo (M_Service)',
    hotline: '1900 5454 41',
    keywords: ['momo'],
  },
];

const BANK_BY_BIN = new Map<string, VietnamBankMeta>(
  VIETNAM_BANKS.map((b) => [b.bin, b])
);

export function computeEmvCrc16(payloadWithoutCrcValue: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payloadWithoutCrcValue.length; i++) {
    crc ^= payloadWithoutCrcValue.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function parseEmvTlv(raw: string): Map<string, string> {
  const tags = new Map<string, string>();
  let idx = 0;
  while (idx + 4 <= raw.length) {
    const tag = raw.slice(idx, idx + 2);
    const lenStr = raw.slice(idx + 2, idx + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenStr)) {
      break;
    }
    const len = Number(lenStr);
    const valueStart = idx + 4;
    const valueEnd = valueStart + len;
    if (valueEnd > raw.length) {
      break;
    }
    tags.set(tag, raw.slice(valueStart, valueEnd));
    idx = valueEnd;
  }
  return tags;
}

export function formatVndAmount(amount: number | null): string {
  if (amount === null || !Number.isFinite(amount) || amount <= 0) return '';
  return `${Math.round(amount).toLocaleString('vi-VN')} đ`;
}

export function parseVietQrPayload(rawPayload: string): VietQrInfo | null {
  const trimmed = (rawPayload || '').trim();
  if (trimmed.length < 16 || !trimmed.startsWith('000201')) {
    return null;
  }

  const root = parseEmvTlv(trimmed);
  if (root.get('00') !== '01') {
    return null;
  }

  const poiCode = root.get('01');
  const pointOfInitiation: VietQrInfo['pointOfInitiation'] =
    poiCode === '11' ? 'static' : poiCode === '12' ? 'dynamic' : 'unknown';

  // Tag 38 is standard NAPAS / VietQR Merchant Account Information
  const napasRaw = root.get('38') ?? root.get('26') ?? '';
  const napasTags = napasRaw ? parseEmvTlv(napasRaw) : new Map<string, string>();
  const guid = (napasTags.get('00') ?? '').toUpperCase();
  const isNapas = guid === 'A000000727' || trimmed.includes('A000000727');

  let bankBin = '';
  let accountNumber = '';
  const memberInfoRaw = napasTags.get('01') ?? '';
  if (memberInfoRaw) {
    const sub = parseEmvTlv(memberInfoRaw);
    if (sub.has('00') || sub.has('01')) {
      bankBin = (sub.get('00') ?? '').replace(/\D/g, '').slice(0, 8);
      accountNumber = (sub.get('01') ?? '').trim();
    } else {
      accountNumber = memberInfoRaw.trim();
    }
  }

  const bankMeta = bankBin ? BANK_BY_BIN.get(bankBin) : undefined;
  const amountRaw = root.get('54') ?? '';
  const parsedAmount = amountRaw && /^\d+(?:\.\d+)?$/.test(amountRaw) ? Number(amountRaw) : null;
  const currencyCode = root.get('53') ?? '704';

  const additionalRaw = root.get('62') ?? '';
  const additionalTags = additionalRaw ? parseEmvTlv(additionalRaw) : new Map<string, string>();
  const purpose = (additionalTags.get('08') ?? additionalTags.get('01') ?? '').trim();

  // Verify CRC-16 (Tag 63, always last 4 chars after "6304")
  let crcValid = false;
  const crcTagIdx = trimmed.lastIndexOf('6304');
  if (crcTagIdx >= 0 && crcTagIdx + 8 === trimmed.length) {
    const bodyForCrc = trimmed.slice(0, crcTagIdx + 4);
    const providedCrc = trimmed.slice(crcTagIdx + 4).toUpperCase();
    crcValid = computeEmvCrc16(bodyForCrc) === providedCrc;
  }

  const bankShortName = bankMeta?.shortName ?? (bankBin ? `Ngân hàng BIN ${bankBin}` : 'Chưa rõ ngân hàng');
  const bankFullName = bankMeta?.fullName ?? (bankBin ? `Mã tổ chức NAPAS ${bankBin}` : 'Mã thanh toán QR');

  // QRIBFTTA = VietQR transfer to bank account; QRIBFTTC = transfer to card
  const serviceCode = (napasTags.get('02') ?? '').toUpperCase();
  const isPersonalAccount = serviceCode === 'QRIBFTTA' || serviceCode === 'QRIBFTTC' || Boolean(accountNumber);

  if (!isNapas && !bankBin && !accountNumber) {
    return null;
  }

  return {
    isVietQr: true,
    crcValid,
    pointOfInitiation,
    bankBin,
    bankShortName,
    bankFullName,
    bankHotline: bankMeta?.hotline ?? '',
    accountNumber,
    amount: parsedAmount,
    amountFormatted: formatVndAmount(parsedAmount),
    currencyCode,
    purpose,
    isPersonalAccount,
    rawPayload: trimmed,
  };
}

export function evaluateVietQrRisk(
  info: VietQrInfo,
  trustedContacts: TrustedContact[],
  contextText = ''
): {
  alertLevel: AlertLevel;
  matchesTrusted: boolean;
  matchesBlocked: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const normAccount = info.accountNumber.replace(/\s+/g, '');

  const matchesBlocked = trustedContacts.some(
    (c) => c.kind === 'blocked' && c.identifier.replace(/\s+/g, '') === normAccount && normAccount.length > 0
  );
  const matchesTrusted = trustedContacts.some(
    (c) => c.kind === 'trusted' && c.identifier.replace(/\s+/g, '') === normAccount && normAccount.length > 0
  );

  const lowerCtx = contextText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');

  const officialClaim = [
    'cong an',
    'toa an',
    'vien kiem sat',
    'thue',
    'bhxh',
    'bao hiem xa hoi',
    'vneid',
    'trung thuong',
    'giai ngan',
    'phi xac minh',
    'nhan qua',
  ].some((kw) => lowerCtx.includes(kw));

  let alertLevel: AlertLevel = 'green';

  if (matchesBlocked) {
    alertLevel = 'red';
    warnings.push(`Số tài khoản nhận tiền (${info.accountNumber}) nằm trong DANH SÁCH ĐEN của Cụ.`);
  }

  if (officialClaim && info.isPersonalAccount) {
    alertLevel = 'red';
    warnings.push(
      `Mã VietQR thực chất chuyển tiền tới tài khoản ${info.bankShortName} (${info.accountNumber}) — cơ quan Công an, Tòa án hay Thuế KHÔNG BAO GIỜ thu tiền qua mã QR này.`
    );
  }

  if (!info.crcValid) {
    if (alertLevel === 'green') alertLevel = 'orange';
    warnings.push('Mã kiểm tra toàn vẹn (CRC-16) của QR VietQR không khớp — mã có thể đã bị chỉnh sửa.');
  }

  if (!matchesTrusted && alertLevel === 'green') {
    alertLevel = 'orange';
    warnings.push(
      `Tài khoản nhận (${info.bankShortName} · ${info.accountNumber || 'không rõ STK'}) chưa nằm trong Danh bạ đáng tin của Cụ — hãy kiểm tra đúng tên chủ tài khoản trên app ngân hàng trước khi bấm xác nhận.`
    );
  }

  return {
    alertLevel,
    matchesTrusted,
    matchesBlocked,
    warnings,
  };
}
