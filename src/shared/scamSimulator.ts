export interface VoiceSimulatorScenario {
  id: string;
  title: string;
  callerBadge: string;
  callerLine: string;
  scamHint: string;
  goodKeywords: string[];
  riskyKeywords: string[];
  coachSuccess: string;
  coachWarning: string;
}

export const VOICE_SIMULATOR_SCENARIOS: VoiceSimulatorScenario[] = [
  {
    id: 'sim-police-otp',
    title: 'Giả danh Công an dọa lệnh bắt & đòi chuyển tiền',
    callerBadge: 'Cuộc gọi lạ xưng Công an',
    callerLine:
      'Alo, tôi là cán bộ điều tra Bộ Công an. Căn cước công dân của bác đang liên quan đường dây rửa tiền, sắp có lệnh tạm giam. Bác giữ bí mật tuyệt đối, không báo cho con cái và đọc mã OTP chuyển tiền vào tài khoản tạm giữ để xác minh ngay!',
    scamHint: 'Dọa tạm giam + cấm kể cho con cái + đòi OTP / chuyển tiền tạm giữ.',
    goodKeywords: [
      'khong chuyen',
      'khong doc',
      'cup may',
      'tat may',
      'ra cong an phuong',
      'cong an xa',
      'goi cho con',
      'hoi con',
      'lua dao',
      'khong tin',
      'truc tiep',
      'giay moi',
    ],
    riskyKeywords: ['doc ma', 'otp day', 'chuyen ngay', 'so tai khoan', 'gui tien', 'vang de toi doc'],
    coachSuccess:
      'Phản xạ tuyệt vời! Cụ đã từ chối đọc OTP/chuyển tiền và chọn cách cúp máy, hỏi con cháu hoặc ra công an phường trực tiếp.',
    coachWarning:
      'Cẩn thận! Cụ không bao giờ được đọc mã OTP hay làm theo lời dọa trên điện thoại. Công an không bao giờ yêu cầu chuyển tiền để chứng minh vô tội.',
  },
  {
    id: 'sim-shipper-cod',
    title: 'Giả danh Shipper báo chuyển nhầm / đòi phí mở khóa thẻ',
    callerBadge: 'Cuộc gọi lạ xưng Shipper',
    callerLine:
      'Bác ơi cháu giao đơn hàng 180 nghìn, bác chuyển khoản vào số này rồi bấm vào đường link cháu gửi qua Zalo để hủy gói hội viên giao hàng tự động, không là mỗi tháng bị trừ 3 triệu đấy bác ạ!',
    scamHint: 'Dọa trừ tiền tự động hàng tháng + dụ bấm link lạ qua Zalo.',
    goodKeywords: [
      'khong bam',
      'khong nhan link',
      'khong dat',
      'khong chuyen',
      'cup may',
      'tat may',
      'goi tong dai',
      'hoi con',
      'lua dao',
      'mang ve',
    ],
    riskyKeywords: ['bam link', 'gui link', 'de toi chuyen', 'huy hoi vien giup'],
    coachSuccess:
      'Rất tỉnh táo! Cụ đã không chuyển khoản trước khi kiểm tra đơn hàng và tuyệt đối không bấm đường link lạ qua Zalo.',
    coachWarning:
      'Nguy hiểm! Thủ đoạn giả Shipper dọa trừ tiền hội viên thường gửi link độc hại hoặc file .apk để chiếm quyền điện thoại.',
  },
  {
    id: 'sim-bank-biometric',
    title: 'Giả nhân viên Ngân hàng đòi cập nhật sinh trắc học qua Zalo',
    callerBadge: 'Cuộc gọi xưng nhân viên Ngân hàng',
    callerLine:
      'Chào bác, hệ thống ngân hàng báo tài khoản của bác sắp bị khóa vì chưa đồng bộ sinh trắc học. Bác kết bạn Zalo rồi cài tệp hướng dẫn .apk cháu gửi để cháu hỗ trợ làm giúp qua màn hình nhé.',
    scamHint: 'Mời kết bạn Zalo + gửi tệp .apk + yêu cầu chia sẻ màn hình.',
    goodKeywords: [
      'ra quay',
      'chi nhanh',
      'tu mo app',
      'khong cai',
      'khong ket ban',
      'cup may',
      'tat may',
      'lua dao',
      'khong can',
    ],
    riskyKeywords: ['cai dat', 'tai ve', 'ket ban zalo', 'chia se man hinh'],
    coachSuccess:
      'Chính xác! Cụ chỉ cập nhật sinh trắc học ngay trên app ngân hàng chính thức hoặc mang CCCD ra trực tiếp quầy giao dịch.',
    coachWarning:
      'Rất nguy hiểm! Cài tệp .apk qua Zalo sẽ khiến kẻ gian xem trộm màn hình và đánh cắp toàn bộ tiền trong tài khoản.',
  },
  {
    id: 'sim-relative-accident',
    title: 'Giả giọng con cháu gọi báo tai nạn cần chuyển tiền gấp',
    callerBadge: 'Video/Thoại mờ nghi giả giọng người thân',
    callerLine:
      'Bà ơi con đây, con bị va quẹt xe đang ở bệnh viện, điện thoại hỏng loa rồi nên giọng hơi rè. Bà chuyển gấp 15 triệu vào số bác sĩ này giúp con đừng gọi lại số cũ nhé!',
    scamHint: 'Giục chuyển gấp + lấy cớ hỏng máy đổi số + cấm gọi lại số cũ.',
    goodKeywords: [
      'mat khau',
      'cau hoi bi mat',
      'goi so cu',
      'goi lai',
      'ten gi',
      'con meo',
      'khong chuyen',
      'kiem tra',
      'hoi bo me',
      'lua dao',
    ],
    riskyKeywords: ['so tai khoan dau', 'chuyen ngay', 'de ba chuyen'],
    coachSuccess:
      'Tuyệt vời! Cụ đã nhớ dùng Mật khẩu bí mật gia đình hoặc cúp máy gọi lại số điện thoại cũ của con cháu để kiểm chứng.',
    coachWarning:
      'Chú ý! Kẻ gian có thể dùng công nghệ giả giọng (Deepfake). Luôn hỏi câu hỏi bí mật gia đình và gọi lại số cũ đã lưu!',
  },
];

export interface SimulatorEvaluation {
  outcome: 'safe' | 'caution' | 'unsafe';
  scoreDelta: number;
  title: string;
  feedback: string;
  matchedGood: string[];
  matchedRisky: string[];
}

function normalizeText(raw: string): string {
  return (raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

export function evaluateSimulatorResponse(
  scenario: VoiceSimulatorScenario,
  userResponse: string
): SimulatorEvaluation {
  const norm = normalizeText(userResponse);
  if (norm.length < 3) {
    return {
      outcome: 'caution',
      scoreDelta: 0,
      title: 'Cụ chưa nói hoặc nhập câu trả lời',
      feedback: 'Cụ hãy bấm micro nói thử hoặc gõ câu trả lời (ví dụ: "Tôi không chuyển đâu, tôi cúp máy gọi cho con").',
      matchedGood: [],
      matchedRisky: [],
    };
  }

  const normWithoutNegatedRisky = norm.replace(
    /\b(?:khong|dung|tuyet doi khong|khong bao gio|khong he|chua)\s+(?:bao gio\s+)?(?:the\s+)?(?:doc|bam|nhan|chuyen|cai|tai|ket ban|chia se)\b/g,
    ' '
  );
  const matchedRisky = scenario.riskyKeywords.filter((kw) => normWithoutNegatedRisky.includes(kw));
  const matchedGood = scenario.goodKeywords.filter((kw) => norm.includes(kw));

  if (matchedRisky.length > 0 && matchedGood.length === 0) {
    return {
      outcome: 'unsafe',
      scoreDelta: 0,
      title: 'Nguy hiểm — Phản xạ này dễ mắc bẫy!',
      feedback: scenario.coachWarning,
      matchedGood,
      matchedRisky,
    };
  }

  if (matchedGood.length >= 1 && matchedRisky.length === 0) {
    return {
      outcome: 'safe',
      scoreDelta: 1,
      title: 'An toàn — Cụ xử lý rất đúng!',
      feedback: scenario.coachSuccess,
      matchedGood,
      matchedRisky,
    };
  }

  return {
    outcome: 'caution',
    scoreDelta: 0,
    title: 'Cần dứt khoát hơn nữa',
    feedback: `${scenario.coachWarning} Cụ nên nói rõ: "Tôi không đọc OTP, không bấm link, tôi cúp máy để gọi cho con cháu."`,
    matchedGood,
    matchedRisky,
  };
}
