import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserHighContrastKey,
  resolveHighContrastPreference,
} from './accessibilitySettings';

test('getUserHighContrastKey scopes preference per user phone or guest', () => {
  assert.equal(getUserHighContrastKey('0912345678'), 'safeai_high_contrast_v2_0912345678');
  assert.equal(getUserHighContrastKey(''), 'safeai_high_contrast_v2_guest');
});

test('resolveHighContrastPreference prioritizes user-scoped setting over global fallback', () => {
  assert.equal(resolveHighContrastPreference('1', '0'), true);
  assert.equal(resolveHighContrastPreference('0', '1'), false);
  assert.equal(resolveHighContrastPreference(null, '1'), true);
  assert.equal(resolveHighContrastPreference(null, null), false);
});
