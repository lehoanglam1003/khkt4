import type { BenchmarkCase, BenchmarkReport } from '../types/safeai.ts';
import { evaluateRuleBasedMessage } from './scamRules.ts';

export const VIETNAMESE_BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'bm-1',
    label: 'Link giả mạo Vietcombank + đòi OTP',
    category: 'Phishing ngân hàng',
    text: 'Tài khoản của quý khách sắp bị khóa sau 2 giờ! Bấm ngay https://vietcombank-xacthuc.xyz/otp để nhập mã OTP xác thực sinh trắc học.',
    expectedLevel: 'red',
  },
  {
    id: 'bm-2',
    label: 'Biên lai báo thành công nhưng đòi phí giải ngân',
    category: 'Biên lai giả',
    text: 'Chuyển khoản thành công 15,000,000 VND. Mã giao dịch: FT123456. Vui lòng nạp thêm 1.500.000đ phí giải ngân vào STK 889911223344 để nhận tiền.',
    expectedLevel: 'red',
  },
  {
    id: 'bm-3',
    label: 'Mã QR chứa link tải tệp .apk độc hại',
    category: 'QR cài mã độc',
    text: 'Quét mã QR để cập nhật VNeID mức 2 ngay.',
    qrPayload: 'https://dichvucong-update.top/app-vneid.apk',
    expectedLevel: 'red',
  },
  {
    id: 'bm-4',
    label: 'Giả danh Công an hù dọa lệnh bắt',
    category: 'Mạo danh cơ quan',
    text: 'Cục Cảnh sát điều tra thông báo có lệnh bắt tạm giam, yêu cầu chuyển tiền vào tài khoản an toàn và đọc mã OTP để chứng minh vô tội.',
    expectedLevel: 'red',
  },
  {
    id: 'bm-5',
    label: 'Trúng thưởng 500 triệu yêu cầu đóng phí',
    category: 'Trúng thưởng ảo',
    text: 'Chúc mừng bạn trúng thưởng 500 triệu đồng, vui lòng đóng phí nhận thưởng 500.000đ để hệ thống giải ngân ngay.',
    expectedLevel: 'red',
  },
  {
    id: 'bm-6',
    label: 'Mạo danh con cháu nhắn mất điện thoại xin tiền gấp',
    category: 'Mạo danh người thân',
    text: 'Mẹ ơi con đây, con bị mất điện thoại nên dùng số mới, chuyển gấp giúp con 3 triệu đang cần đóng tiền gấp.',
    expectedLevel: 'orange',
  },
  {
    id: 'bm-7',
    label: 'Link rút gọn bit.ly kèm lời mời kiểm tra đơn',
    category: 'Link rút gọn đáng ngờ',
    text: 'Đơn hàng của bạn gặp sự cố, xem chi tiết tại https://bit.ly/kiem-tra-don-hang-123',
    expectedLevel: 'orange',
  },
  {
    id: 'bm-8',
    label: 'Punycode giả mạo tên miền ngân hàng',
    category: 'Tên miền Punycode',
    text: 'Kiểm tra tài khoản tại https://xn--vitcombank-e6a.com',
    expectedLevel: 'red',
  },
  {
    id: 'bm-9',
    label: 'Tin khuyến mãi chính thức của VinaPhone',
    category: 'Tin hợp lệ (Không báo nhầm)',
    text: 'VinaPhone thông báo chương trình khuyến mãi nạp thẻ ngày vàng. Xem thể lệ tại https://khuyenmai.vinaphone.com.vn/uu-dai hoặc ứng dụng My VNPT.',
    expectedLevel: 'green',
  },
  {
    id: 'bm-10',
    label: 'Thông báo cước VNPT hợp lệ',
    category: 'Tin hợp lệ (Không báo nhầm)',
    text: 'VNPT thông báo chương trình ưu đãi gia hạn gói cước internet tại https://vnpt.com.vn/khuyen-mai.',
    expectedLevel: 'green',
  },
  {
    id: 'bm-11',
    label: 'Tin nhắn gia đình hỏi thăm bình thường',
    category: 'Tin hợp lệ (Không báo nhầm)',
    text: 'Bố mẹ tối nay ăn cơm chưa ạ, cuối tuần cháu sang chơi với ông bà nhé.',
    expectedLevel: 'green',
  },
  {
    id: 'bm-12',
    label: 'Nhắc lịch khám bệnh thông thường',
    category: 'Tin hợp lệ (Không báo nhầm)',
    text: 'Nhắc lịch tái khám định kỳ vào sáng thứ Sáu lúc 8h30 tại phòng khám số 4.',
    expectedLevel: 'green',
  },
];

export function runBenchmarkEvaluation(cases: BenchmarkCase[] = VIETNAMESE_BENCHMARK_CASES): BenchmarkReport {
  const results = cases.map((c) => {
    const out = evaluateRuleBasedMessage(c.text, c.qrPayload ?? '', []);
    return {
      id: c.id,
      label: c.label,
      category: c.category,
      expected: c.expectedLevel,
      actual: out.alertLevel,
      passed: out.alertLevel === c.expectedLevel,
    };
  });

  // Positive class = risky ('red' | 'orange'); Negative class = safe ('green')
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;

  for (const r of results) {
    const expectedRisky = r.expected !== 'green';
    const actualRisky = r.actual !== 'green';
    if (expectedRisky && actualRisky) tp++;
    else if (!expectedRisky && actualRisky) fp++;
    else if (expectedRisky && !actualRisky) fn++;
    else tn++;
  }

  const total = results.length;
  const exactMatches = results.filter((r) => r.passed).length;
  const accuracy = total > 0 ? Math.round((exactMatches / total) * 100) : 0;
  const recall = tp + fn > 0 ? Math.round((tp / (tp + fn)) * 100) : 100;
  const precision = tp + fp > 0 ? Math.round((tp / (tp + fp)) * 100) : 100;
  const falsePositiveRate = fp + tn > 0 ? Math.round((fp / (fp + tn)) * 100) : 0;

  return {
    total,
    accuracy,
    recall,
    precision,
    falsePositiveRate,
    results,
  };
}
