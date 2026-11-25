import { evaluateVietQrRisk, parseVietQrPayload } from './vietqrParser.ts';
import type {
  AlertLevel,
  BoundingBox,
  ExtractedEntities,
  ReceiptForensics,
  ScanResult,
  TrustedContact,
  VietQrInfo,
} from '../types/safeai.ts';

export const IMPERSONATION_TERMS = [
  'cong an', 'canh sat', 'toa an', 'vien kiem sat', 'bo cong an',
  'ngan hang', 'vietcombank', 'techcombank', 'bidv', 'agribank', 'vietinbank',
  'mbbank', 'vpbank', 'sacombank', 'tpbank', 'shb', 'acb',
  'bao hiem xa hoi', 'bhxh', 'thue', 'dien luc', 'evn', 'buu dien',
  'viettel', 'vinaphone', 'mobifone', 'vietnamobile',
  'benh vien', 'cong chung', 'dang kiem', 'ho chieu', 'xuat nhap canh',
  'chuyen tien', 'otp', 'ma xac thuc', 'mat khau', 'tai khoan bi khoa',
  'cccd', 'can cuoc', 'dinh danh',
] as const;

export const OFFICIAL_CARRIER_DOMAINS = ['vnpt.com.vn', 'vinaphone.com.vn'] as const;

export const OFFICIAL_BANK_DOMAINS = [
  'vietcombank.com.vn',
  'techcombank.com',
  'techcombank.com.vn',
  'bidv.com.vn',
  'agribank.com.vn',
  'vietinbank.vn',
  'mbbank.com.vn',
  'vpbank.com.vn',
  'acb.com.vn',
  'tpb.vn',
  'sacombank.com.vn',
  'dichvucong.gov.vn',
  'bocongan.gov.vn',
] as const;

export const URL_SHORTENER_HOSTS = [
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'rebrand.ly',
  'is.gd',
  'cutt.ly',
  'shorturl.at',
  'bom.so',
  's.net.vn',
] as const;

export function stripDiacritics(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function normalizePhone(value: string): string {
  const digits = (value || '').replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  return digits;
}

export function normalizeLookupUrl(raw: string): { valid: boolean; normalized: string; hostname: string } {
  const trimmed = (raw || '').trim().replace(/[.,;:!?)\]}]+$/, '');
  if (!trimmed) return { valid: false, normalized: '', hostname: '' };
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname || !parsed.hostname.includes('.')) {
      return { valid: false, normalized: '', hostname: '' };
    }
    parsed.hash = '';
    return { valid: true, normalized: parsed.toString(), hostname: parsed.hostname.toLowerCase() };
  } catch {
    return { valid: false, normalized: '', hostname: '' };
  }
}

export function extractEntitiesFromText(text: string, qrPayload = ''): ExtractedEntities {
  const raw = `${text || ''}\n${qrPayload || ''}`;
  const urlMatches = raw.match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  const urls = Array.from(
    new Set(
      urlMatches
        .map((u) => u.replace(/[.,;:!?)\]}]+$/, ''))
        .filter((u) => u.length >= 10)
    )
  ).slice(0, 8);

  const phoneMatches = raw.match(/(?:^|[\s:(])((?:\+?84|0)[235789](?:[\s.-]?\d){7,9})\b/g) ?? [];
  const phones = Array.from(
    new Set(phoneMatches.map(normalizePhone).filter((p) => p.length >= 9 && p.length <= 11))
  ).slice(0, 8);

  const accountMatches = raw.match(/\b\d{8,16}\b/g) ?? [];
  const phoneSet = new Set(phones);
  const bankAccounts = Array.from(
    new Set(accountMatches.filter((acc) => !phoneSet.has(acc) && !phoneSet.has(normalizePhone(acc))))
  ).slice(0, 6);

  return {
    urls,
    phones,
    bankAccounts,
    qrPayload: (qrPayload || '').trim(),
  };
}

export function isOfficialCarrierPromotion(message: string): boolean {
  const normalized = stripDiacritics(message);
  const urls = (message || '').match(/https?:\/\/[^\s<>"']+/gi) ?? [];
  if (urls.length === 0) return false;
  if (!normalized.includes('vinaphone') && !normalized.includes('vnpt')) return false;
  if (!['khuyen mai', 'chuong trinh', 'tham gia'].some((kw) => normalized.includes(kw))) {
    return false;
  }

  for (const candidate of urls) {
    const parsed = normalizeLookupUrl(candidate);
    if (!parsed.valid) return false;
    const isOfficial = OFFICIAL_CARRIER_DOMAINS.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`)
    );
    if (!isOfficial) return false;
  }

  const highRiskRequests = [
    'otp', 'mat khau', 'ma xac thuc', 'ma pin', 'chuyen khoan',
    'tai khoan ca nhan', 'dong phi', 'phi nhan qua', 'phi rut tien',
    'giai ngan', 'nap tien de rut', 'nap tien truoc de nhan',
    'nap tien de mo khoa', 'bao dam loi nhuan',
  ];
  return !highRiskRequests.some((term) => normalized.includes(term));
}

export interface ImpersonationCheck {
  matchedTrusted: TrustedContact[];
  matchedBlocked: TrustedContact[];
  impersonationTerms: string[];
  warning: string;
}

export function detectImpersonation(message: string, contacts: TrustedContact[]): ImpersonationCheck {
  const normalized = stripDiacritics(message);
  const digitsOnly = (message || '').replace(/\D/g, '');
  const matchedTrusted: TrustedContact[] = [];
  const matchedBlocked: TrustedContact[] = [];

  for (const contact of contacts) {
    const labelNorm = stripDiacritics(contact.label).trim();
    const idDigits = (contact.identifier || '').replace(/\D/g, '');
    const foundByLabel = labelNorm.length >= 3 && normalized.includes(labelNorm);
    const foundByDigits = idDigits.length >= 9 && digitsOnly.includes(idDigits);
    if (!foundByLabel && !foundByDigits) continue;
    if (contact.kind === 'blocked') {
      matchedBlocked.push(contact);
    } else {
      matchedTrusted.push(contact);
    }
  }

  const impersonationTerms = IMPERSONATION_TERMS.filter((term) => normalized.includes(term));
  let warning = '';

  if (matchedBlocked.length > 0) {
    const names = matchedBlocked.map((c) => c.label).join(', ');
    warning = `Nội dung trùng với mục trong DANH SÁCH ĐEN của Cụ (${names}). Tuyệt đối không làm theo, không chuyển tiền và không cung cấp mã xác thực.`;
  } else if (impersonationTerms.length > 0 && matchedTrusted.length === 0) {
    warning =
      'Nội dung nhắc tới đơn vị/cơ quan uy tín hoặc giao dịch nhạy cảm nhưng KHÔNG khớp danh bạ đáng tin của Cụ. Hãy tự gọi lại bằng số chính thức đã lưu.';
  }

  return { matchedTrusted, matchedBlocked, impersonationTerms, warning };
}

export function analyzeReceiptConsistency(text: string): ReceiptForensics {
  const normalized = stripDiacritics(text);
  const receiptMarkers = [
    'chuyen khoan thanh cong',
    'bien lai',
    'ma giao dich',
    'so tham chieu',
    'tai khoan thu huong',
    'ngay giao dich',
    'vnd',
  ];
  const isReceiptLike = receiptMarkers.filter((m) => normalized.includes(m)).length >= 2;

  const bankCatalog: [string, string][] = [
    ['vietcombank', 'Vietcombank'],
    ['techcombank', 'Techcombank'],
    ['bidv', 'BIDV'],
    ['agribank', 'Agribank'],
    ['vietinbank', 'VietinBank'],
    ['mbbank', 'MB Bank'],
    ['acb', 'ACB'],
    ['vpbank', 'VPBank'],
    ['tpbank', 'TPBank'],
  ];
  const foundBank = bankCatalog.find(([kw]) => normalized.includes(kw))?.[1] ?? '';

  const anomalies: string[] = [];
  if (isReceiptLike || normalized.includes('chuyen khoan thanh cong')) {
    if (
      normalized.includes('chuyen khoan thanh cong') &&
      ['nap them', 'phi giai ngan', 'phi mo khoa', 'dong phi', 'dat coc'].some((t) =>
        normalized.includes(t)
      )
    ) {
      anomalies.push(
        'Mâu thuẫn nội dung: Biên lai báo "Chuyển khoản thành công" nhưng lại yêu cầu nạp thêm phí hoặc đặt cọc để nhận tiền.'
      );
    }
    if (normalized.includes('chuyen nham') && normalized.includes('chuyen tra')) {
      anomalies.push(
        'Dấu hiệu bẫy "chuyển nhầm tiền": Kẻ gian thường dùng ảnh biên lai chỉnh sửa rồi thúc giục chuyển trả vào tài khoản khác.'
      );
    }
    if (!/\b(?:ft|tf|ref|gd|trace)\w{4,}/i.test(normalized) && !/\b\d{6,}\b/.test(normalized)) {
      anomalies.push('Thiếu mã giao dịch / số tham chiếu chuẩn thường thấy trên biên lai ngân hàng.');
    }
  }

  return {
    isReceiptLike: isReceiptLike || anomalies.length > 0,
    detectedBank: foundBank,
    anomalies,
  };
}

export function detectFamilyImpersonationTrigger(text: string): boolean {
  const normalized = stripDiacritics(text);
  const familyRefs = ['con day', 'chau day', 'me oi', 'bo oi', 'ong oi', 'ba oi', 'nguoi nha', 'mat dien thoai', 'so moi'];
  const urgentMoney = ['chuyen tien', 'chuyen gap', 'muon tien', 'vay gap', 'dong tien', 'tai nan', 'cap cuu'];
  return (
    familyRefs.some((f) => normalized.includes(f)) &&
    urgentMoney.some((u) => normalized.includes(u))
  );
}

export function detectLiveCallRisk(transcript: string): {
  level: AlertLevel;
  matchedTriggers: string[];
  alertHeadline: string;
} {
  const normalized = stripDiacritics(transcript);
  const criticalTriggers: [string, string][] = [
    ['cong an', 'Xưng danh Công an / cơ quan điều tra'],
    ['vien kiem sat', 'Xưng danh Viện kiểm sát'],
    ['toa an', 'Xưng danh Tòa án / lệnh bắt'],
    ['ra toa', 'Đe dọa hầu tòa / lệnh triệu tập'],
    ['trieu tap', 'Dọa có giấy triệu tập'],
    ['lenh bat', 'Đe dọa có lệnh bắt giữ'],
    ['otp', 'Yêu cầu đọc mã OTP'],
    ['ma xac thuc', 'Yêu cầu đọc mã xác thực'],
    ['chuyen tien', 'Thúc giục chuyển tiền'],
    ['tai khoan an toan', 'Dụ chuyển tiền sang "tài khoản an toàn"'],
    ['cai ung dung', 'Hướng dẫn cài ứng dụng lạ'],
    ['chia se man hinh', 'Yêu cầu chia sẻ màn hình'],
    ['sinh trac hoc', 'Lấy cớ cập nhật sinh trắc học'],
    ['vneid', 'Lấy cớ cập nhật VNeID'],
  ];

  const matched = criticalTriggers
    .filter(([kw]) => normalized.includes(kw))
    .map(([, label]) => label);

  if (matched.length >= 2 || normalized.includes('otp') || normalized.includes('tai khoan an toan')) {
    return {
      level: 'red',
      matchedTriggers: matched,
      alertHeadline: 'CẢNH BÁO CUỘC GỌI NGUY HIỂM: Phát hiện kịch bản lừa đảo qua điện thoại!',
    };
  }
  if (matched.length === 1) {
    return {
      level: 'orange',
      matchedTriggers: matched,
      alertHeadline: 'LƯU Ý: Cuộc gọi nhắc tới nội dung nhạy cảm — chưa vội làm theo.',
    };
  }
  return {
    level: 'green',
    matchedTriggers: [],
    alertHeadline: 'Chưa ghi nhận từ khóa thúc ép hay đòi OTP trong đoạn thoại.',
  };
}

export function classifyChatAlertLevel(
  userMessage: string,
  replyText: string,
  scanContext = ''
): AlertLevel {
  const callRisk = detectLiveCallRisk(userMessage);
  if (callRisk.level === 'red') return 'red';

  const ruleEval = evaluateRuleBasedMessage(userMessage, '', []);
  if (ruleEval.alertLevel === 'red') return 'red';

  const normMsg = stripDiacritics(userMessage);
  const normReply = stripDiacritics(replyText);

  if (
    normReply.includes('canh bao cuoc goi nguy hiem') ||
    normReply.includes('canh bao do') ||
    normReply.includes('cup may ngay') ||
    normMsg.includes('.apk')
  ) {
    return 'red';
  }

  if (scanContext.toUpperCase().includes('MỨC CẢNH BÁO: RED')) {
    return 'red';
  }

  if (
    callRisk.level === 'orange' ||
    ruleEval.alertLevel === 'orange' ||
    (normMsg.includes('link') && (normMsg.includes('la') || normMsg.includes('bam'))) ||
    normMsg.includes('bien lai') ||
    normMsg.includes('cat ghep') ||
    normMsg.includes('chuyen khoan') ||
    normReply.includes('luu y') ||
    normReply.includes('canh giac') ||
    scanContext.toUpperCase().includes('MỨC CẢNH BÁO: ORANGE')
  ) {
    return 'orange';
  }

  return 'green';
}

export function isShortenedOrApkUrl(rawUrl: string): { isShortened: boolean; isApkOrBinary: boolean } {
  const parsed = normalizeLookupUrl(rawUrl);
  if (!parsed.valid) return { isShortened: false, isApkOrBinary: false };
  const isShortened = URL_SHORTENER_HOSTS.some(
    (h) => parsed.hostname === h || parsed.hostname.endsWith(`.${h}`)
  );
  const lowerUrl = parsed.normalized.toLowerCase();
  const isApkOrBinary = /\.(apk|exe|msi|bat|scr|ipa)(?:$|\?)/i.test(lowerUrl);
  return { isShortened, isApkOrBinary };
}

export function inspectUrlHeuristics(rawUrl: string): {
  valid: boolean;
  normalizedUrl: string;
  hostname: string;
  status: 'safe_signal' | 'suspicious' | 'danger' | 'unverified';
  reasons: string[];
} {
  const parsed = normalizeLookupUrl(rawUrl);
  if (!parsed.valid) {
    return {
      valid: false,
      normalizedUrl: '',
      hostname: '',
      status: 'unverified',
      reasons: ['Đường link không đúng định dạng URL hợp lệ.'],
    };
  }

  const host = parsed.hostname;
  const reasons: string[] = [];
  let riskPoints = 0;

  const { isShortened, isApkOrBinary } = isShortenedOrApkUrl(parsed.normalized);
  if (isApkOrBinary) {
    riskPoints += 4;
    reasons.push('Liên kết trỏ trực tiếp tới tệp cài đặt (.apk/.exe) — nguy cơ chiếm quyền điều khiển điện thoại.');
  }
  if (isShortened) {
    riskPoints += 1;
    reasons.push('Liên kết dùng dịch vụ rút gọn URL che giấu địa chỉ đích thật sự.');
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    riskPoints += 3;
    reasons.push('Link dùng địa chỉ IP trực tiếp thay vì tên miền chính thức.');
  }
  if (host.includes('xn--')) {
    riskPoints += 3;
    reasons.push('Tên miền chứa ký tự mã hóa quốc tế (Punycode) dễ dùng để giả mạo chữ cái.');
  }
  const suspiciousTlds = ['.xyz', '.top', '.click', '.vip', '.loan', '.club', '.shop', '.icu', '.cc', '.tk'];
  if (suspiciousTlds.some((tld) => host.endsWith(tld))) {
    riskPoints += 2;
    reasons.push('Đuôi tên miền thường bị lợi dụng cho trang giả mạo hoặc khuyến mãi ảo.');
  }
  if ((host.match(/-/g) ?? []).length >= 2) {
    riskPoints += 1;
    reasons.push('Tên miền có nhiều dấu gạch ngang ghép từ dễ gây nhầm lẫn.');
  }

  const isOfficialBankOrGov = OFFICIAL_BANK_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
  const isOfficialCarrier = OFFICIAL_CARRIER_DOMAINS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );

  if ((isOfficialBankOrGov || isOfficialCarrier) && !isApkOrBinary) {
    return {
      valid: true,
      normalizedUrl: parsed.normalized,
      hostname: host,
      status: 'safe_signal',
      reasons: ['Tên miền khớp với hệ thống ngân hàng, nhà mạng hoặc cổng dịch vụ công chính thức tại Việt Nam.'],
    };
  }

  const lookalikeKeywords = ['vietcombank', 'techcombank', 'bidv', 'agribank', 'mb-bank', 'mbbank', 'vneid', 'dichvucong', 'bocongan', 'evn', 'zalopay', 'momo'];
  const hostCompact = host.replace(/[-.]/g, '');
  if (lookalikeKeywords.some((kw) => hostCompact.includes(kw.replace(/-/g, '')))) {
    riskPoints += 3;
    reasons.push('Tên miền chứa tên ngân hàng/cơ quan nhà nước nhưng KHÔNG phải tên miền chính thức.');
  }

  if (riskPoints >= 3) {
    return { valid: true, normalizedUrl: parsed.normalized, hostname: host, status: 'danger', reasons };
  }
  if (riskPoints >= 1) {
    return { valid: true, normalizedUrl: parsed.normalized, hostname: host, status: 'suspicious', reasons };
  }
  return {
    valid: true,
    normalizedUrl: parsed.normalized,
    hostname: host,
    status: 'unverified',
    reasons: ['Chưa có dấu hiệu giả mạo rõ rệt về cấu trúc tên miền, nhưng Cụ vẫn nên tự mở ứng dụng chính thức để kiểm tra.'],
  };
}

export function evaluateRuleBasedMessage(
  text: string,
  qrPayload = '',
  contacts: TrustedContact[] = []
): Omit<ScanResult, 'id' | 'sourceMode' | 'createdAt' | 'imagePreviewUrl'> {
  const combined = `${text}\n${qrPayload}`.trim();
  const normalized = stripDiacritics(combined);
  const entities = extractEntitiesFromText(combined, qrPayload);
  const receiptForensics = analyzeReceiptConsistency(combined);

  let level: AlertLevel = 'green';
  let scamType = 'Nội dung chưa thấy dấu hiệu lừa đảo';
  let summary = 'Nội dung trông hợp lý và chưa ghi nhận dấu hiệu thúc ép hoặc đòi thông tin nhạy cảm.';
  const evidence: ScanResult['visualEvidence'] = [];
  const actionSteps: string[] = [];

  if (isOfficialCarrierPromotion(combined)) {
    level = 'green';
    scamType = 'Thông báo khuyến mãi nhà mạng hợp lệ';
    summary =
      'Thông báo khớp tên miền chính thức của VNPT/VinaPhone và không yêu cầu mã OTP, mật khẩu hay chuyển khoản cá nhân.';
    actionSteps.push(
      'Kiểm tra chi tiết trong ứng dụng My VNPT chính thức.',
      'Không cung cấp mã OTP hoặc mật khẩu cho bất kỳ ai.'
    );
  } else {
    const redPatterns = [
      'otp',
      'ma xac thuc',
      'nap them',
      'phi giai ngan',
      'phi mo khoa',
      'khoa tai khoan',
      'khoa sau',
      'trung thuong',
      'nhan thuong',
      'vneid',
      'sinh trac hoc',
      'lenh bat',
      'ra toa',
      'giay trieu tap',
      'trieu tap',
      'nop phat',
      'bao lanh',
      'giu bi mat',
      'chuyen tam',
      'tai khoan an toan',
      'cai ung dung',
    ];
    const matchedRed = redPatterns.filter((p) => normalized.includes(p));
    const urlStatuses = entities.urls.map((u) => inspectUrlHeuristics(u));
    const hasDangerUrl = urlStatuses.some((u) => u.status === 'danger');
    const hasSuspiciousUrl = urlStatuses.some((u) => u.status === 'suspicious');

    if (matchedRed.length >= 2 || hasDangerUrl || receiptForensics.anomalies.length > 0) {
      level = 'red';
      scamType =
        receiptForensics.anomalies.length > 0
          ? 'Biên lai chuyển khoản / giải ngân giả mạo'
          : hasDangerUrl
            ? 'Giả mạo đường link / QR ngân hàng & cơ quan'
            : 'Kịch bản lừa đảo chiếm đoạt tài sản';
      summary =
        'Phát hiện dấu hiệu lừa đảo rõ ràng như thúc ép khẩn cấp, yêu cầu OTP/phí giải ngân hoặc đường link giả mạo.';
      if (matchedRed.length > 0) {
        evidence.push({
          category: 'Ngôn từ thúc ép / nhạy cảm',
          finding: `Xuất hiện cụm từ rủi ro cao (${matchedRed.slice(0, 3).join(', ')}).`,
          severity: 'high',
        });
      }
      if (hasDangerUrl) {
        const bad = urlStatuses.find((u) => u.status === 'danger');
        evidence.push({
          category: 'Liên kết / QR nguy hiểm',
          finding: `${bad?.hostname}: ${bad?.reasons[0]}`,
          severity: 'high',
        });
      }
      for (const anomaly of receiptForensics.anomalies) {
        evidence.push({
          category: 'Phân tích biên lai',
          finding: anomaly,
          severity: 'high',
        });
      }
      actionSteps.push(
        'Tuyệt đối không chuyển tiền, không đọc mã OTP và không cài tệp/ứng dụng lạ.',
        'Không bấm vào liên kết hoặc quét mã QR trong nội dung này.',
        'Tự gọi lại số ngân hàng sau thẻ ATM hoặc người thân theo số cũ đã lưu.'
      );
    } else if (matchedRed.length === 1 || hasSuspiciousUrl || detectFamilyImpersonationTrigger(combined)) {
      level = 'orange';
      scamType = detectFamilyImpersonationTrigger(combined)
        ? 'Nghi vấn mạo danh người thân vay/xin tiền gấp'
        : 'Nội dung đáng ngờ cần xác minh thêm';
      summary = 'Có yếu tố bất thường hoặc chưa xác minh được nguồn gửi, Cụ chưa nên làm theo ngay.';
      evidence.push({
        category: 'Tín hiệu đáng nghi',
        finding: 'Nội dung yêu cầu hành động khẩn hoặc chứa liên kết chưa rõ uy tín.',
        severity: 'medium',
      });
      actionSteps.push(
        'Dừng lại kiểm chứng trực tiếp bằng cách gọi vào số điện thoại cũ đã lưu.',
        'Không bấm link hoặc chuyển tiền khi chưa gặp mặt/nghe giọng xác nhận.'
      );
    } else {
      actionSteps.push(
        'Giữ thói quen kiểm tra lại thông tin trên ứng dụng chính thức.',
        'Không chia sẻ OTP hay mật khẩu ngân hàng cho bất kỳ ai.'
      );
    }
  }

  return mergeImageScanSignals(
    {
      alertLevel: level,
      scamType,
      confidence: level === 'green' ? 'medium' : 'high',
      summary,
      visualEvidence: evidence,
      extractedText: text,
      extractedEntities: entities,
      actionSteps,
      receiptForensics,
      familyChallengeTriggered: detectFamilyImpersonationTrigger(combined),
      reply: summary,
    },
    qrPayload,
    contacts
  );
}

export function mergeImageScanSignals(
  aiScan: Omit<ScanResult, 'id' | 'sourceMode' | 'createdAt' | 'imagePreviewUrl'>,
  qrPayload: string,
  contacts: TrustedContact[],
  qrBbox?: BoundingBox
): Omit<ScanResult, 'id' | 'sourceMode' | 'createdAt' | 'imagePreviewUrl'> {
  const combinedText = `${aiScan.extractedText}\n${qrPayload}`.trim();
  const entities = extractEntitiesFromText(combinedText, qrPayload);
  const mergedUrls = Array.from(new Set([...(aiScan.extractedEntities?.urls ?? []), ...entities.urls]));
  const mergedPhones = Array.from(new Set([...(aiScan.extractedEntities?.phones ?? []), ...entities.phones]));
  const mergedAccounts = Array.from(
    new Set([...(aiScan.extractedEntities?.bankAccounts ?? []), ...entities.bankAccounts])
  );

  let level: AlertLevel = aiScan.alertLevel;
  let scamType = aiScan.scamType;
  let summary = aiScan.summary;
  const isGenericGreenCopy =
    scamType === 'Nội dung chưa thấy dấu hiệu lừa đảo' ||
    summary.startsWith('Nội dung trông hợp lý');
  const evidence = [...(aiScan.visualEvidence ?? [])];
  const actionSteps = [...(aiScan.actionSteps ?? [])];
  let impersonationWarning = '';

  const receiptForensics = aiScan.receiptForensics ?? analyzeReceiptConsistency(combinedText);
  if (receiptForensics.anomalies.length > 0 && level === 'green') {
    level = 'orange';
    if (isGenericGreenCopy) {
      scamType = 'Biên lai chuyển khoản có dấu hiệu bất thường';
      summary = receiptForensics.anomalies[0];
    }
  }

  // Check QR URL safety or VietQR bank transfer info if QR decoded
  let parsedVietQr: VietQrInfo | null = aiScan.vietQr ?? null;
  if (qrPayload) {
    parsedVietQr = parseVietQrPayload(qrPayload);
    if (parsedVietQr) {
      const qrRisk = evaluateVietQrRisk(parsedVietQr, contacts, combinedText);
      if (qrRisk.alertLevel === 'red') {
        level = 'red';
        if (isGenericGreenCopy || scamType === 'Nội dung chưa thấy dấu hiệu lừa đảo') {
          scamType = 'Lừa đảo thu tiền qua mã VietQR';
          summary = qrRisk.warnings[0] || summary;
        }
      } else if (qrRisk.alertLevel === 'orange' && level === 'green') {
        level = 'orange';
        if (isGenericGreenCopy) {
          scamType = 'Mã VietQR chuyển tiền cần xác minh';
          summary = qrRisk.warnings[0] || summary;
        }
      }
      if (parsedVietQr.accountNumber && !mergedAccounts.includes(parsedVietQr.accountNumber)) {
        mergedAccounts.push(parsedVietQr.accountNumber);
      }
      if (qrRisk.warnings.length > 0) {
        evidence.unshift({
          category: 'Giải mã VietQR ngân hàng',
          finding: qrRisk.warnings[0],
          severity: qrRisk.alertLevel === 'red' ? 'high' : 'medium',
          bbox: qrBbox,
        });
      } else {
        evidence.push({
          category: 'Giải mã VietQR ngân hàng',
          finding: `Mã QR chuyển tới ${parsedVietQr.bankShortName} (STK: ${parsedVietQr.accountNumber}) khớp danh bạ đáng tin.`,
          severity: 'low',
          bbox: qrBbox,
        });
      }
    }

    const urlCheck = inspectUrlHeuristics(qrPayload);
    if (urlCheck.valid && (urlCheck.status === 'danger' || urlCheck.status === 'suspicious')) {
      const qrFinding =
        urlCheck.status === 'danger'
          ? `Mã QR trỏ tới đường link có dấu hiệu giả mạo (${urlCheck.hostname}): ${urlCheck.reasons[0]}`
          : `Mã QR chứa link đáng nghi (${urlCheck.hostname}): ${urlCheck.reasons[0]}`;
      const qrSeverity = urlCheck.status === 'danger' ? 'high' : 'medium';

      if (urlCheck.status === 'danger') {
        level = 'red';
        if (scamType === 'Nội dung chưa thấy dấu hiệu lừa đảo') {
          scamType = 'Mã QR dẫn tới đường link nguy hiểm';
          summary = qrFinding;
        }
      } else if (level === 'green') {
        level = 'orange';
        if (scamType === 'Nội dung chưa thấy dấu hiệu lừa đảo') {
          scamType = 'Mã QR chứa đường link đáng ngờ';
          summary = qrFinding;
        }
      }

      const existingIdx = evidence.findIndex(
        (ev) => ev.category === 'Mã QR trong ảnh' || ev.finding === qrFinding
      );
      if (existingIdx >= 0) {
        if (qrBbox && !evidence[existingIdx].bbox) {
          evidence[existingIdx] = { ...evidence[existingIdx], bbox: qrBbox };
        }
      } else {
        evidence.unshift({
          category: 'Mã QR trong ảnh',
          finding: qrFinding,
          severity: qrSeverity,
          bbox: qrBbox,
        });
      }
    }
  }

  const officialPromo = isOfficialCarrierPromotion(combinedText);
  if (officialPromo && level !== 'red') {
    level = 'green';
    summary =
      'Đây có vẻ là thông báo khuyến mãi từ tên miền chính thức của VNPT/VinaPhone và không hỏi OTP hay chuyển khoản cá nhân.';
  }

  const impersonation = detectImpersonation(combinedText, contacts);
  if (impersonation.matchedBlocked.length > 0) {
    level = 'red';
    impersonationWarning = impersonation.warning;
    if (scamType === 'Nội dung chưa thấy dấu hiệu lừa đảo') {
      scamType = 'Trùng khớp danh sách chặn cảnh báo';
      summary = impersonation.warning;
    }
  } else if (impersonation.warning && !officialPromo) {
    impersonationWarning = impersonation.warning;
    if (level === 'green') {
      level = 'orange';
      if (scamType === 'Nội dung chưa thấy dấu hiệu lừa đảo') {
        scamType = 'Nhắc tên đơn vị/giao dịch nhạy cảm cần xác minh';
        summary = impersonation.warning;
      }
    }
  }

  const familyChallengeTriggered =
    aiScan.familyChallengeTriggered || detectFamilyImpersonationTrigger(combinedText);

  const replyLines = [summary];
  if (impersonationWarning) {
    replyLines.unshift(`⚠️ ${impersonationWarning}`);
  }
  if (actionSteps.length > 0) {
    replyLines.push('', 'Cần làm gì:', ...actionSteps.map((s) => `- ${s}`));
  }

  return {
    ...aiScan,
    alertLevel: level,
    scamType,
    summary,
    visualEvidence: evidence,
    extractedEntities: {
      urls: mergedUrls,
      phones: mergedPhones,
      bankAccounts: mergedAccounts,
      qrPayload: qrPayload || aiScan.extractedEntities?.qrPayload || '',
    },
    actionSteps,
    receiptForensics,
    vietQr: parsedVietQr,
    familyChallengeTriggered,
    impersonationWarning,
    reply: replyLines.join('\n'),
  };
}
