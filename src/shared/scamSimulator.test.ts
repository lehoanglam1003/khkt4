import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSimulatorResponse,
  VOICE_SIMULATOR_SCENARIOS,
} from './scamSimulator.ts';

test('evaluateSimulatorResponse rewards refusing OTP and calling family', () => {
  const scenario = VOICE_SIMULATOR_SCENARIOS[0];
  const res = evaluateSimulatorResponse(scenario, 'Tôi không đọc mã OTP đâu, tôi cúp máy gọi cho con!');
  assert.equal(res.outcome, 'safe');
  assert.equal(res.scoreDelta, 1);
});

test('evaluateSimulatorResponse warns when user agrees to read OTP or click link', () => {
  const scenario = VOICE_SIMULATOR_SCENARIOS[0];
  const res = evaluateSimulatorResponse(scenario, 'Vâng để tôi đọc mã OTP đây');
  assert.equal(res.outcome, 'unsafe');
  assert.equal(res.scoreDelta, 0);
});

test('evaluateSimulatorResponse flags short empty replies as caution', () => {
  const scenario = VOICE_SIMULATOR_SCENARIOS[1];
  const res = evaluateSimulatorResponse(scenario, '');
  assert.equal(res.outcome, 'caution');
});
