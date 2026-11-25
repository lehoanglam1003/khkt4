import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIncidentReportText,
  detectMentionedBanks,
  GOLDEN_HOUR_CHECKLIST,
} from './recoveryGuide.ts';
import type { ScanResult } from '../types/safeai.ts';

const SAMPLE_SCAN: ScanResult = {
  id: 'scan-1',
  sourceMode: 'image',
  alertLevel: 'red',
  scamType: 'Giả mạo ngân hàng',
  confidence: 'high',
  summary: 'Phát hiện đường link giả mạo Vietcombank đòi OTP.',
  visualEvidence: [],
  extractedText: 'Vui lòng nhập OTP tại vietcombank-xacthuc.xyz',
  extractedEntities: {
    urls: ['https://vietcombank-xacthuc.xyz'],
    phones: ['0999888777'],
    bankAccounts: ['102938475612'],
    qrPayload: '',
  },
  actionSteps: [],
  reply: 'Cảnh báo Đỏ',
  createdAt: '2026-11-17T00:00:00.000Z',
};

test('detectMentionedBanks finds Vietcombank hotline from scan text', () => {
  const banks = detectMentionedBanks(SAMPLE_SCAN);
  assert.ok(banks.length >= 1);
  assert.equal(banks[0].shortName, 'Vietcombank');
  assert.equal(banks[0].hotline, '1900 5454 13');
});

test('buildIncidentReportText pre-fills extracted bank accounts, phones, and URLs', () => {
  const report = buildIncidentReportText(SAMPLE_SCAN, 'Lỡ chuyển nhầm 2 triệu', '2.000.000 đ');
  assert.ok(report.includes('102938475612'));
  assert.ok(report.includes('0999888777'));
  assert.ok(report.includes('https://vietcombank-xacthuc.xyz'));
  assert.ok(report.includes('2.000.000 đ'));
  assert.ok(GOLDEN_HOUR_CHECKLIST.length >= 4);
});
