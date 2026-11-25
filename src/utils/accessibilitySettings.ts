export const GLOBAL_HIGH_CONTRAST_KEY = 'safeai_high_contrast_global_v2';

export function getUserHighContrastKey(phone: string): string {
  const scope = phone.trim() || 'guest';
  return `safeai_high_contrast_v2_${scope}`;
}

export function resolveHighContrastPreference(
  userStoredValue: string | null,
  globalStoredValue: string | null
): boolean {
  if (userStoredValue === '1' || userStoredValue === 'true') return true;
  if (userStoredValue === '0' || userStoredValue === 'false') return false;
  return globalStoredValue === '1' || globalStoredValue === 'true';
}

export function applyHighContrastToRoot(root: HTMLElement | null, enabled: boolean): void {
  if (!root) return;
  if (enabled) {
    root.classList.add('high-contrast');
    root.setAttribute('data-high-contrast', 'true');
  } else {
    root.classList.remove('high-contrast');
    root.removeAttribute('data-high-contrast');
  }
}
