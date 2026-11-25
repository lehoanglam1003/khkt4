import { detectLiveCallRisk, evaluateRuleBasedMessage, inspectUrlHeuristics } from './scamRules.ts';
import { computeEmvCrc16, evaluateVietQrRisk, parseVietQrPayload } from './vietqrParser.ts';
import type { AlertLevel, VietQrInfo } from '../types/safeai.ts';

export type GuideTopic = 'qr' | 'voice';

export interface GuideStep {
  stepNumber: number;
  title: string;
  summary: string;
  tipForSeniors: string;
}

export const QR_GUIDE_STEPS: GuideStep[] = [
  {
    stepNumber: 1,
    title: 'Bước 1: Quét đa vùng ảnh để đọc sạch mã QR bị nhỏ hoặc mờ',
    summary:
      'Khi Cụ tải ảnh chụp màn hình Zalo hoặc biên lai, SafeAI tự động cắt và rà 6 vùng khác nhau (toàn ảnh, phần giữa, nửa dưới và phiên bản tăng độ tương phản) để không bỏ sót mã QR nhỏ nằm ở góc ảnh.',
    tipForSeniors:
      'Nếu ảnh hơi mờ hoặc nghiêng, Cụ có thể bấm nút "Xoay 90°", "Cắt gần vùng giữa" hoặc "Tăng tương phản chữ" ngay bên dưới ảnh xem trước.',
  },
  {
    stepNumber: 2,
    title: 'Bước 2: Giải mã đích đến ngân hàng (VietQR / EMVCo) & liên kết ẩn',
    summary:
      'Nếu là mã chuyển khoản VietQR, SafeAI tách từng thẻ chuẩn EMVCo (ngân hàng nhận, số tài khoản, số tiền cài sẵn, nội dung chuyển khoản) và kiểm tra mã toàn vẹn CRC-16. Nếu là đường link web, SafeAI tự mở lớp link rút gọn để phát hiện tên miền giả mạo hoặc tệp cài đặt .apk độc hại.',
    tipForSeniors:
      'Kẻ gian thường gửi mã QR tự nhận là "kho bạc / công an thu tiền tạm giữ", nhưng khi SafeAI giải mã sẽ lộ rõ đó là tài khoản cá nhân bình thường.',
  },
  {
    stepNumber: 3,
    title: 'Bước 3: Đối chiếu bẫy lừa đảo & bật cảnh báo 3 màu Đỏ / Cam / Xanh',
    summary:
      'Cuối cùng, SafeAI kết hợp nội dung chữ trên ảnh, đích đến mã QR và Danh bạ tin cậy / Danh sách chặn của gia đình để gắn nhãn Đỏ (Nguy hiểm), Cam (Cần kiểm tra kỹ) hoặc Xanh (An toàn) và đọc to kết quả bằng tiếng Việt.',
    tipForSeniors:
      'Thấy MỨC ĐỎ hoặc MỨC CAM, Cụ tuyệt đối không quét chuyển tiền trên app ngân hàng mà bấm "Hỏi con cháu 1 chạm" ngay.',
  },
];

export const VOICE_GUIDE_STEPS: GuideStep[] = [
  {
    stepNumber: 1,
    title: 'Bước 1: Lắng nghe giọng nói tiếng Việt qua Micro thiết bị',
    summary:
      'SafeAI chuyển lời nói tiếng Việt thành chữ theo hai cách: dùng bộ nhận diện tiếng Việt trực tiếp của trình duyệt (Chrome/Edge) ngay trên máy, hoặc ghi âm gửi bộ chép lời dự phòng. Để nhận diện chuẩn, Cụ hãy mở trang ở tab trình duyệt riêng (HTTPS) và cho phép quyền Micro.',
    tipForSeniors:
      'Khi nhận cuộc gọi đáng nghi, Cụ bật loa ngoài điện thoại rồi đặt gần máy đang mở SafeAI, hoặc đọc lại nguyên văn điều người kia vừa yêu cầu.',
  },
  {
    stepNumber: 2,
    title: 'Bước 2: Lá chắn cuộc gọi tự động bắt từ khóa mồi & kịch bản tâm lý',
    summary:
      'Ngay khi có chữ từ cuộc nói chuyện, bộ phân tích Lá chắn cuộc gọi kiểm tra tức thì các cụm từ nguy hiểm như: "xưng công an / tòa án", "lệnh bắt giữ", "đọc mã OTP", "chuyển tiền vào tài khoản an toàn", "cài app VNeID qua link .apk".',
    tipForSeniors:
      'Công an, Tòa án, Viện kiểm sát và Ngân hàng KHÔNG BAO GIỜ gọi điện yêu cầu chuyển tiền xác minh hay đọc mã OTP qua điện thoại.',
  },
  {
    stepNumber: 3,
    title: 'Bước 3: Báo động Đỏ tại chỗ, phát loa "Cúp máy ngay" & báo người thân',
    summary:
      'Khi phát hiện kịch bản lừa đảo, SafeAI đổi khung cảnh báo sang MỨC ĐỎ, rung cảnh báo (trên điện thoại hỗ trợ), hiện nút phát loa nhắc Cúp máy ngay, và gửi tín hiệu tức thì về máy Con/Cháu nếu đã ghép phòng gia đình.',
    tipForSeniors:
      'Nếu không tiện dùng micro, Cụ vẫn có thể bấm nút "Thử kịch bản cuộc gọi giả danh" hoặc vào "Nhật ký → Tập trận cuộc gọi giọng nói" để luyện phản xạ.',
  },
];

function buildGuideVietQrString(
  bin: string,
  account: string,
  amount: string,
  purpose: string
): string {
  const tlv = (tag: string, val: string) =>
    `${tag}${String(val.length).padStart(2, '0')}${val}`;
  const member = `${tlv('00', bin)}${tlv('01', account)}`;
  const merchant38 = `${tlv('00', 'A000000727')}${tlv('01', member)}${tlv('02', 'QRIBFTTA')}`;
  const add62 = purpose ? tlv('62', tlv('08', purpose)) : '';
  const body =
    tlv('00', '01') +
    tlv('01', amount ? '12' : '11') +
    tlv('38', merchant38) +
    tlv('53', '704') +
    (amount ? tlv('54', amount) : '') +
    tlv('58', 'VN') +
    add62 +
    '6304';
  return body + computeEmvCrc16(body);
}

export interface GuideQrSample {
  id: string;
  label: string;
  payload: string;
  contextNote: string;
}

export const GUIDE_QR_SAMPLES: GuideQrSample[] = [
  {
    id: 'qr-fake-police',
    label: 'Thử QR giả danh Công an thu tiền',
    payload: buildGuideVietQrString('970436', '102938475612', '500000', 'Tam giu ho so xac minh'),
    contextNote: 'Tin nhắn gửi kèm: Yêu cầu chuyển 500.000đ vào tài khoản tạm giữ của cơ quan công an.',
  },
  {
    id: 'qr-fake-bank-link',
    label: 'Thử QR chứa link giả ngân hàng',
    payload: 'https://vietcombank-xacthuc.xyz/cap-nhat-sinh-trac-hoc.apk',
    contextNote: 'Ảnh kèm lời mời quét QR để cập nhật sinh trắc học gấp trước khi khóa thẻ.',
  },
  {
    id: 'qr-safe-official',
    label: 'Thử QR trang tra cứu chính thức',
    payload: 'https://dichvucong.gov.vn/p/home/dvc-trang-chu.html',
    contextNote: 'Mã QR dẫn tới Cổng Dịch vụ công Quốc gia.',
  },
];

export interface GuideQrInspectionResult {
  sample: GuideQrSample;
  alertLevel: AlertLevel;
  headline: string;
  explanation: string;
  vietQr: VietQrInfo | null;
  tagBreakdown: { tag: string; meaning: string; value: string }[];
  reasons: string[];
}

export function inspectGuideQrSample(sample: GuideQrSample): GuideQrInspectionResult {
  const parsed = parseVietQrPayload(sample.payload);
  if (parsed) {
    const risk = evaluateVietQrRisk(parsed, [], sample.contextNote);
    return {
      sample,
      alertLevel: risk.alertLevel,
      headline:
        risk.alertLevel === 'red'
          ? 'Cảnh báo ĐỎ: Mã VietQR có dấu hiệu lừa đảo!'
          : risk.alertLevel === 'orange'
            ? 'Cảnh báo CAM: Cần đối chiếu kỹ trước khi chuyển'
            : 'Mức XANH: Mã VietQR hợp lệ',
      explanation:
        'SafeAI đã tách từng thẻ chuẩn EMVCo/NAPAS bên trong chuỗi QR để cho Cụ thấy tiền thực sự sẽ đi về ngân hàng và số tài khoản nào.',
      vietQr: parsed,
      tagBreakdown: [
        { tag: 'Thẻ 00', meaning: 'Chuẩn định dạng', value: 'EMVCo VietQR v01' },
        {
          tag: 'Thẻ 38',
          meaning: 'Ngân hàng & Số tài khoản đích',
          value: `${parsed.bankShortName} (BIN ${parsed.bankBin}) · STK ${parsed.accountNumber || '—'}`,
        },
        {
          tag: 'Thẻ 54',
          meaning: 'Số tiền cài sẵn',
          value: parsed.amountFormatted || 'Không cố định (người gửi tự nhập)',
        },
        {
          tag: 'Thẻ 62',
          meaning: 'Nội dung chuyển khoản',
          value: parsed.purpose || 'Không có',
        },
        {
          tag: 'Thẻ 63',
          meaning: 'Mã kiểm tra toàn vẹn CRC-16',
          value: parsed.crcValid ? 'Hợp lệ (không bị sửa chữ giữa đường)' : 'LỖI CRC-16 (mã QR có dấu hiệu bị chỉnh sửa)',
        },
      ],
      reasons: risk.warnings,
    };
  }

  const urlEval = inspectUrlHeuristics(sample.payload);
  const alertLevel: AlertLevel =
    urlEval.status === 'danger'
      ? 'red'
      : urlEval.status === 'safe_signal'
        ? 'green'
        : 'orange';

  return {
    sample,
    alertLevel,
    headline:
      alertLevel === 'red'
        ? 'Cảnh báo ĐỎ: QR dẫn tới đường link hoặc tệp cài đặt nguy hiểm!'
        : alertLevel === 'green'
          ? 'Mức XANH: QR dẫn tới trang web chính thức'
          : 'Cảnh báo CAM: QR dẫn tới đường link chưa xác thực',
    explanation:
      'Mã QR này không phải mã chuyển khoản ngân hàng mà là một đường link web. SafeAI kiểm tra tên miền thật và đuôi tệp (.apk) trước khi Cụ bấm vào.',
    vietQr: null,
    tagBreakdown: [
      { tag: 'Địa chỉ đích', meaning: 'Tên miền thực tế trong QR', value: urlEval.hostname || sample.payload },
      { tag: 'Phân loại', meaning: 'Trạng thái an toàn', value: urlEval.status === 'danger' ? 'Nguy hiểm' : urlEval.status === 'safe_signal' ? 'Tên miền chính thức' : 'Cần cảnh giác' },
    ],
    reasons: urlEval.reasons,
  };
}

export interface GuideVoiceSample {
  id: string;
  label: string;
  transcript: string;
}

export const GUIDE_VOICE_SAMPLES: GuideVoiceSample[] = [
  {
    id: 'voice-police',
    label: 'Câu giả danh Công an đòi OTP',
    transcript:
      'Alo tôi bên Công an điều tra, bác có lệnh triệu tập, đọc ngay mã OTP và chuyển tiền sang tài khoản an toàn để xác minh VNeID.',
  },
  {
    id: 'voice-family-sos',
    label: 'Câu giả người thân cấp cứu',
    transcript:
      'Bố ơi con đang cấp cứu bị mất máy rồi, bố chuyển gấp 5 triệu vào số tài khoản bác sĩ giúp con nhé!',
  },
  {
    id: 'voice-safe',
    label: 'Cuộc gọi gia đình bình thường',
    transcript:
      'Bố ơi chiều nay mấy giờ con qua nhà đón bố đi khám sức khỏe định kỳ ạ?',
  },
];

export interface GuideVoiceInspectionResult {
  sample: GuideVoiceSample;
  alertLevel: AlertLevel;
  headline: string;
  matchedKeywords: string[];
  advice: string;
}

export function inspectGuideVoiceSample(sample: GuideVoiceSample): GuideVoiceInspectionResult {
  const callRisk = detectLiveCallRisk(sample.transcript);
  if (callRisk.level !== 'green') {
    return {
      sample,
      alertLevel: callRisk.level,
      headline: callRisk.alertHeadline,
      matchedKeywords: callRisk.matchedTriggers,
      advice:
        'Lá chắn cuộc gọi đã bắt được từ khóa nguy hiểm ngay lập tức: Cụ hãy cúp máy ngay, không đọc OTP và gọi lại cho con cháu bằng số cũ.',
    };
  }

  const ruleEval = evaluateRuleBasedMessage(sample.transcript, '', []);
  if (ruleEval.alertLevel !== 'green' || ruleEval.familyChallengeTriggered) {
    return {
      sample,
      alertLevel: ruleEval.alertLevel === 'red' ? 'red' : 'orange',
      headline: ruleEval.scamType,
      matchedKeywords: ruleEval.visualEvidence.map((e) => e.category).slice(0, 3),
      advice: ruleEval.summary,
    };
  }

  return {
    sample,
    alertLevel: 'green',
    headline: 'Mức XANH: Chưa thấy từ khóa lừa đảo trong câu nói này',
    matchedKeywords: [],
    advice:
      'Câu nói bình thường, không yêu cầu OTP, không ép chuyển tiền khẩn cấp hay cài ứng dụng lạ.',
  };
}
