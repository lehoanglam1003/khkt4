import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeReceiptConsistency,
  classifyChatAlertLevel,
  detectFamilyImpersonationTrigger,
  detectImpersonation,
  detectLiveCallRisk,
  extractEntitiesFromText,
  inspectUrlHeuristics,
  isOfficialCarrierPromotion,
  isShortenedOrApkUrl,
  mergeImageScanSignals,
  normalizePhone,
  stripDiacritics,
} from './scamRules.ts';
import { runBenchmarkEvaluation } from './benchmarkSuite.ts';
import type { TrustedContact } from '../types/safeai.ts';

test('stripDiacritics removes Vietnamese tones and converts đ', () => {
  assert.equal(stripDiacritics('Công An Điện Lực Đắk Lắk'), 'cong an dien luc dak lak');
});

test('normalizePhone converts +84 to 0 prefix', () => {
  assert.equal(normalizePhone('+84 912-345-678'), '0912345678');
  assert.equal(normalizePhone('0987 654 321'), '0987654321');
});

test('isOfficialCarrierPromotion allows safe VinaPhone promo and rejects OTP requests', () => {
  assert.equal(
    isOfficialCarrierPromotion('VinaPhone khuyen mai nap the tai https://khuyenmai.vinaphone.com.vn/uu-dai'),
    true
  );
  assert.equal(
    isOfficialCarrierPromotion('VinaPhone khuyen mai nap the tai https://vinaphone.com.vn, vui long doc ma OTP'),
    false
  );
  assert.equal(
    isOfficialCarrierPromotion('VinaPhone khuyen mai tai https://vinaphone-tangqua.xyz'),
    false
  );
});

test('inspectUrlHeuristics flags lookalike bank domains, APK payloads, and allows official domains', () => {
  const fake = inspectUrlHeuristics('https://vietcombank-xacthuc.xyz/login');
  assert.equal(fake.status, 'danger');

  const apk = inspectUrlHeuristics('https://update-app.site/dichvucong.apk');
  assert.equal(apk.status, 'danger');

  const shortFlag = isShortenedOrApkUrl('https://bit.ly/nhan-qua');
  assert.equal(shortFlag.isShortened, true);

  const official = inspectUrlHeuristics('https://vcbdigibank.vietcombank.com.vn');
  assert.equal(official.status, 'safe_signal');
});

test('analyzeReceiptConsistency catches fake disbursement fee contradictions', () => {
  const result = analyzeReceiptConsistency(
    'Vietcombank: Chuyển khoản thành công 15,000,000 VND. Vui lòng nạp thêm 1.500.000đ phí giải ngân.'
  );
  assert.equal(result.isReceiptLike, true);
  assert.equal(result.detectedBank, 'Vietcombank');
  assert.ok(result.anomalies.length >= 1);
});

test('detectLiveCallRisk flags critical phone scam scripts immediately', () => {
  const red = detectLiveCallRisk('Tôi là công an điều tra, đọc mã OTP để chuyển tiền vào tài khoản an toàn');
  assert.equal(red.level, 'red');
  assert.ok(red.matchedTriggers.length >= 2);
});

test('detectFamilyImpersonationTrigger triggers family challenge phrase prompt', () => {
  assert.equal(
    detectFamilyImpersonationTrigger('Mẹ ơi con đây, con bị mất điện thoại nên chuyển gấp 3 triệu nhé'),
    true
  );
});

test('detectImpersonation upgrades alert to red when blocked contact matches', () => {
  const contacts: TrustedContact[] = [
    { id: '1', label: 'So lua dao gia danh', identifier: '0999888777', kind: 'blocked', createdAt: '2026-01-01' },
  ];
  const check = detectImpersonation('Goi ngay 0999 888 777 de xac nhan', contacts);
  assert.equal(check.matchedBlocked.length, 1);

  const merged = mergeImageScanSignals(
    {
      alertLevel: 'orange',
      scamType: 'Tin nhắn nghi ngờ',
      confidence: 'medium',
      summary: 'Cần kiểm tra thêm',
      visualEvidence: [],
      extractedText: 'Goi ngay 0999 888 777',
      extractedEntities: { urls: [], phones: [], bankAccounts: [], qrPayload: '' },
      actionSteps: ['Không gọi lại số lạ'],
      reply: 'Cần kiểm tra thêm',
    },
    '',
    contacts
  );
  assert.equal(merged.alertLevel, 'red');
  assert.ok(merged.impersonationWarning?.includes('DANH SÁCH ĐEN'));
});

test('mergeImageScanSignals escalates to red when decoded QR contains lookalike bank domain', () => {
  const merged = mergeImageScanSignals(
    {
      alertLevel: 'orange',
      scamType: 'Ảnh chứa mã QR',
      confidence: 'medium',
      summary: 'Ảnh có mã QR cần kiểm tra.',
      visualEvidence: [],
      extractedText: 'Quét mã để cập nhật sinh trắc học',
      extractedEntities: { urls: [], phones: [], bankAccounts: [], qrPayload: '' },
      actionSteps: ['Không quét mã lạ'],
      reply: 'Ảnh có mã QR cần kiểm tra.',
    },
    'https://bidv-capnhat-cccd.vip/verify',
    []
  );
  assert.equal(merged.alertLevel, 'red');
  assert.ok(merged.extractedEntities.urls.includes('https://bidv-capnhat-cccd.vip/verify'));
});

test('extractEntitiesFromText extracts URLs, phones, and bank account numbers separately', () => {
  const entities = extractEntitiesFromText(
    'Chuyen vao STK 102938475612 hoac goi 0912 345 678 tai https://example.vn/pay',
    ''
  );
  assert.deepEqual(entities.phones, ['0912345678']);
  assert.deepEqual(entities.bankAccounts, ['102938475612']);
  assert.deepEqual(entities.urls, ['https://example.vn/pay']);
});

test('Vietnamese anti-scam benchmark achieves 100% accuracy and 0% false positive rate on standard suite', () => {
  const report = runBenchmarkEvaluation();
  assert.equal(report.total, 12);
  assert.equal(report.recall, 100);
  assert.equal(report.falsePositiveRate, 0);
  assert.equal(report.accuracy, 100);
});

test('classifyChatAlertLevel assigns red, orange, and green levels accurately for AI chat replies', () => {
  assert.equal(
    classifyChatAlertLevel('Có người gọi xưng công an bảo tôi ra tòa, tôi phải làm sao?', ''),
    'red'
  );
  assert.equal(
    classifyChatAlertLevel('Làm sao phân biệt ảnh chuyển khoản thật và ảnh cắt ghép?', ''),
    'orange'
  );
  assert.equal(
    classifyChatAlertLevel('Tôi lỡ bấm vào đường link lạ rồi thì cần làm gì ngay?', ''),
    'orange'
  );
  assert.equal(
    classifyChatAlertLevel('Cháu ơi sáng nay bác kiểm tra tin nhắn thế nào cho an toàn?', 'Cháu chào Cụ!'),
    'green'
  );
});
