import type { DiaryEntry, TrainingScenario } from '../types/safeai.ts';

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    id: 'otp_request',
    title: 'Cuộc gọi xin mã OTP',
    categoryTag: 'otp',
    prompt: 'Người tự xưng là nhân viên ngân hàng nói tài khoản có lỗi và yêu cầu đọc mã OTP vừa gửi về máy.',
    choices: [
      { text: 'Đọc mã để họ giúp khóa tài khoản kịp thời', correct: false },
      { text: 'Không đọc mã; tự gọi số in trên thẻ hoặc ứng dụng chính thức', correct: true },
    ],
    lesson: 'Ngân hàng không bao giờ yêu cầu đọc mã OTP qua điện thoại. Hãy tự gọi lại số chính thức trên thẻ.',
  },
  {
    id: 'fake_receipt_image',
    title: 'Ảnh chụp biên lai chuyển khoản mờ hoặc cắt ghép',
    categoryTag: 'receipt',
    prompt: 'Người lạ gửi ảnh màn hình báo đã chuyển nhầm tiền hoặc đã đóng phí thành công nhưng tiền chưa về tài khoản, thúc giục chuyển trả ngay.',
    choices: [
      { text: 'Tin ảnh chụp màn hình và chuyển trả lại ngay cho họ đỡ lo', correct: false },
      { text: 'Chỉ kiểm tra số dư trực tiếp trong ứng dụng ngân hàng của mình', correct: true },
    ],
    lesson: 'Ảnh biên lai chuyển khoản rất dễ bị chỉnh sửa chữ và số. Luôn mở app ngân hàng kiểm tra biến động số dư thật.',
  },
  {
    id: 'qr_biometric_trap',
    title: 'Ảnh chứa mã QR cập nhật sinh trắc học',
    categoryTag: 'qr',
    prompt: 'Một tin nhắn kèm ảnh có mã QR yêu cầu quét để "cập nhật CCCD / sinh trắc học trước khi bị khóa tài khoản".',
    choices: [
      { text: 'Không quét mã QR từ ảnh lạ; mang CCCD ra quầy hoặc dùng app ngân hàng chính thức', correct: true },
      { text: 'Quét thử xem trang web trông có giống ngân hàng không', correct: false },
    ],
    lesson: 'Mã QR có thể dẫn thẳng tới trang web giả mạo hoặc tải file độc hại chiếm quyền điều khiển điện thoại.',
  },
  {
    id: 'family_impersonation',
    title: 'Người thân nhắn tin khẩn cấp',
    categoryTag: 'family',
    prompt: 'Một tài khoản lạ dùng ảnh đại diện giống con cháu, nói đang mất điện thoại và xin chuyển tiền gấp.',
    choices: [
      { text: 'Gọi trực tiếp vào số điện thoại cũ đã lưu để nghe giọng xác minh', correct: true },
      { text: 'Chuyển tiền ngay vì thấy ảnh đại diện giống người nhà', correct: false },
    ],
    lesson: 'Kẻ gian dễ dàng lấy ảnh đại diện công khai trên mạng xã hội. Luôn gọi lại số cũ đã lưu để xác minh.',
  },
];

export function sortScenariosForUser(
  scenarios: TrainingScenario[],
  diaryEntries: DiaryEntry[]
): { ordered: TrainingScenario[]; prioritizedCategory: TrainingScenario['categoryTag'] | null } {
  if (!diaryEntries.length) {
    return { ordered: scenarios, prioritizedCategory: null };
  }

  const recentText = diaryEntries
    .slice(0, 8)
    .map((e) => `${e.scamType} ${e.sourceText}`.toLowerCase())
    .join(' ');

  let prioritized: TrainingScenario['categoryTag'] | null = null;
  if (/biên lai|chuyển khoản|phí giải ngân|chuyển nhầm/.test(recentText)) {
    prioritized = 'receipt';
  } else if (/qr|sinh trắc|link|rút gọn|apk/.test(recentText)) {
    prioritized = 'qr';
  } else if (/người thân|con đây|cháu đây|mất điện thoại|cấp cứu/.test(recentText)) {
    prioritized = 'family';
  } else if (/otp|công an|tài khoản an toàn|tòa án/.test(recentText)) {
    prioritized = 'otp';
  }

  if (!prioritized) {
    return { ordered: scenarios, prioritizedCategory: null };
  }

  const ordered = [...scenarios].sort((a, b) => {
    const aMatch = a.categoryTag === prioritized ? 0 : 1;
    const bMatch = b.categoryTag === prioritized ? 0 : 1;
    return aMatch - bMatch;
  });

  return { ordered, prioritizedCategory: prioritized };
}

export interface EmergencySituation {
  key: string;
  label: string;
  nextStep: string;
  checklist: string[];
}

export const EMERGENCY_SITUATIONS: EmergencySituation[] = [
  {
    key: 'chua_thao_tac',
    label: 'Mới nhận tin nhắn / ảnh nghi ngờ, chưa làm theo',
    nextStep: 'Dừng lại ngay: không bấm link, không quét mã QR, không chuyển tiền và chụp lưu lại màn hình để báo người thân.',
    checklist: [
      'Không trả lời hoặc gọi lại theo số ghi trong tin nhắn/ảnh',
      'Không bấm đường link hoặc quét mã QR',
      'Gửi ảnh chụp cho con cháu hoặc người thân tin cậy kiểm chứng',
    ],
  },
  {
    key: 'da_bam_link_hoac_cai_app',
    label: 'Đã lỡ bấm link lạ hoặc cài ứng dụng theo hướng dẫn',
    nextStep: 'Ngắt Wi-Fi / 4G ngay lập tức để cắt kết nối từ xa, sau đó gọi người thân hoặc ngân hàng khóa tạm tài khoản.',
    checklist: [
      'Tắt Wi-Fi và dữ liệu di động (4G/5G) trên điện thoại ngay',
      'Không nhập thêm mật khẩu ngân hàng hay mã OTP',
      'Nhờ người thân gỡ ứng dụng lạ hoặc mang máy ra điểm hỗ trợ',
    ],
  },
  {
    key: 'da_lo_otp_hoac_chuyen_tien',
    label: 'Đã lỡ đọc OTP, mật khẩu hoặc chuyển tiền',
    nextStep: 'Gọi ngay tổng đài chính thức in trên mặt sau thẻ ngân hàng để khóa thẻ/tài khoản khẩn cấp, sau đó trình báo công an gần nhất.',
    checklist: [
      'Gọi tổng đài ngân hàng (số in sau thẻ) yêu cầu khóa khẩn cấp tài khoản/thẻ',
      'Đổi mật khẩu ứng dụng ngân hàng từ một thiết bị an toàn khác',
      'Giữ toàn bộ ảnh chụp tin nhắn, số tài khoản nhận tiền để trình báo công an',
    ],
  },
];
