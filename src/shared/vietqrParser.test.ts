import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEmvCrc16,
  evaluateVietQrRisk,
  parseVietQrPayload,
} from './vietqrParser.ts';
import type { TrustedContact } from '../types/safeai.ts';

function buildSampleVietQr({
  bin = '970436',
  account = '102938475612',
  amount = '200000',
  purpose = 'Phi xac minh ho so',
}: {
  bin?: string;
  account?: string;
  amount?: string;
  purpose?: string;
} = {}): string {
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

test('parseVietQrPayload decodes Vietcombank BIN, account, amount, purpose, and valid CRC', () => {
  const qr = buildSampleVietQr();
  const parsed = parseVietQrPayload(qr);
  assert.ok(parsed);
  assert.equal(parsed.isVietQr, true);
  assert.equal(parsed.crcValid, true);
  assert.equal(parsed.bankBin, '970436');
  assert.equal(parsed.bankShortName, 'Vietcombank');
  assert.equal(parsed.bankHotline, '1900 5454 13');
  assert.equal(parsed.accountNumber, '102938475612');
  assert.equal(parsed.amount, 200000);
  assert.equal(parsed.purpose, 'Phi xac minh ho so');
  assert.equal(parsed.isPersonalAccount, true);
});

test('parseVietQrPayload detects tampered CRC-16 checksum', () => {
  const qr = buildSampleVietQr();
  const tampered = qr.slice(0, -4) + 'FFFF';
  const parsed = parseVietQrPayload(tampered);
  assert.ok(parsed);
  assert.equal(parsed.crcValid, false);
});

test('evaluateVietQrRisk raises red alert when context claims government/police collection', () => {
  const qr = buildSampleVietQr({ bin: '970418', account: '9988776655' });
  const parsed = parseVietQrPayload(qr)!;
  const risk = evaluateVietQrRisk(
    parsed,
    [],
    'Cơ quan Công an yêu cầu quét mã QR nộp phạt xác minh CCCD'
  );
  assert.equal(risk.alertLevel, 'red');
  assert.ok(risk.warnings.some((w) => w.includes('BIDV')));
});

test('evaluateVietQrRisk marks trusted contact QR as green', () => {
  const qr = buildSampleVietQr({ bin: '970422', account: '0912345678', amount: '' });
  const parsed = parseVietQrPayload(qr)!;
  const contacts: TrustedContact[] = [
    {
      id: 't1',
      label: 'Con trai Minh',
      identifier: '0912345678',
      kind: 'trusted',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ];
  const risk = evaluateVietQrRisk(parsed, contacts, 'Chuyển tiền ăn cho con');
  assert.equal(risk.alertLevel, 'green');
  assert.equal(risk.matchesTrusted, true);
});
