import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getGuideStepsByTopic,
  GUIDE_QR_SAMPLES,
  GUIDE_VOICE_SAMPLES,
  inspectGuideQrSample,
  inspectGuideVoiceSample,
  OVERVIEW_GUIDE_STEPS,
  SOS_FAMILY_GUIDE_STEPS,
} from './guideContent.ts';

test('getGuideStepsByTopic returns complete steps for overview, qr, voice, and sos_family', () => {
  assert.equal(getGuideStepsByTopic('overview').length, OVERVIEW_GUIDE_STEPS.length);
  assert.ok(OVERVIEW_GUIDE_STEPS.length >= 4);
  assert.equal(getGuideStepsByTopic('sos_family').length, SOS_FAMILY_GUIDE_STEPS.length);
  assert.ok(SOS_FAMILY_GUIDE_STEPS.length >= 4);
  assert.ok(getGuideStepsByTopic('qr').length >= 3);
  assert.ok(getGuideStepsByTopic('voice').length >= 3);
});

test('inspectGuideQrSample decodes VietQR police scam sample as red with valid CRC-16', () => {
  const policeSample = GUIDE_QR_SAMPLES.find((s) => s.id === 'qr-fake-police');
  assert.ok(policeSample);
  const res = inspectGuideQrSample(policeSample);
  assert.equal(res.alertLevel, 'red');
  assert.ok(res.vietQr);
  assert.equal(res.vietQr.bankShortName, 'Vietcombank');
  assert.equal(res.vietQr.accountNumber, '102938475612');
  assert.equal(res.vietQr.crcValid, true);
  assert.ok(res.tagBreakdown.length >= 4);
});

test('inspectGuideQrSample flags lookalike bank .apk QR URL as red and official gov.vn as green', () => {
  const bankLink = GUIDE_QR_SAMPLES.find((s) => s.id === 'qr-fake-bank-link');
  const official = GUIDE_QR_SAMPLES.find((s) => s.id === 'qr-safe-official');
  assert.ok(bankLink && official);

  const bankRes = inspectGuideQrSample(bankLink);
  assert.equal(bankRes.alertLevel, 'red');
  assert.equal(bankRes.vietQr, null);

  const safeRes = inspectGuideQrSample(official);
  assert.equal(safeRes.alertLevel, 'green');
});

test('inspectGuideVoiceSample triggers red alert on police OTP script and green on normal family call', () => {
  const police = GUIDE_VOICE_SAMPLES.find((s) => s.id === 'voice-police');
  const familySos = GUIDE_VOICE_SAMPLES.find((s) => s.id === 'voice-family-sos');
  const safe = GUIDE_VOICE_SAMPLES.find((s) => s.id === 'voice-safe');
  assert.ok(police && familySos && safe);

  const policeRes = inspectGuideVoiceSample(police);
  assert.equal(policeRes.alertLevel, 'red');
  assert.ok(policeRes.matchedKeywords.length >= 1);

  const familyRes = inspectGuideVoiceSample(familySos);
  assert.ok(familyRes.alertLevel === 'orange' || familyRes.alertLevel === 'red');

  const safeRes = inspectGuideVoiceSample(safe);
  assert.equal(safeRes.alertLevel, 'green');
});
