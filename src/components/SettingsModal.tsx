import { useEffect } from 'react';
import { Contrast, LogOut, User, Volume2, X } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import type { UserAccount, VoiceRegion } from '../types/safeai';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  highContrast: boolean;
  onToggleHighContrast: (next: boolean) => void;
  autoSpeak: boolean;
  onToggleAutoSpeak: (next: boolean) => void;
  voiceRegion: VoiceRegion;
  onChangeVoiceRegion: (region: VoiceRegion) => void;
  onOpenFamilySettings: () => void;
  onOpenGuide?: () => void;
  currentUser?: UserAccount;
  onLogout?: () => void;
}

const REGION_OPTIONS: { id: VoiceRegion; label: string }[] = [
  { id: 'auto', label: 'Tự động' },
  { id: 'bac', label: 'Miền Bắc' },
  { id: 'trung', label: 'Miền Trung' },
  { id: 'nam', label: 'Miền Nam' },
];

export function SettingsModal({
  isOpen,
  onClose,
  highContrast,
  onToggleHighContrast,
  autoSpeak,
  onToggleAutoSpeak,
  voiceRegion,
  onChangeVoiceRegion,
  onOpenFamilySettings,
  onOpenGuide,
  currentUser,
  onLogout,
}: SettingsModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="settings-modal-title" className="text-xl font-bold text-slate-900">
              Cài đặt dễ đọc &amp; Giọng nói
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Tùy chỉnh cỡ chữ đậm nét hơn và giọng đọc tiếng Việt cho Ông/Bà.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cài đặt"
            className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* High Contrast Mode Toggle */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Contrast className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <span id="modal-hc-label" className="text-base font-bold text-slate-900">
                  Chế độ chữ đậm &amp; rõ nét
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Tăng cỡ chữ lớn hơn, đậm đen trên nền trắng để Ông/Bà dễ đọc hơn.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={highContrast}
              aria-labelledby="modal-hc-label"
              onClick={() => onToggleHighContrast(!highContrast)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition-colors ${
                highContrast
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span
                className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                  highContrast ? 'bg-white/30' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                    highContrast ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </span>
              <span>{highContrast ? 'Đang bật' : 'Đang tắt'}</span>
            </button>
          </div>

          {/* Auto-Speak Feedback Toggle */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <span id="modal-autospeak-label" className="text-base font-bold text-slate-900">
                  Tự động đọc to kết quả
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                Tự đọc to lời khuyên bằng tiếng Việt ngay khi kiểm tra xong.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={autoSpeak}
              aria-labelledby="modal-autospeak-label"
              onClick={() => onToggleAutoSpeak(!autoSpeak)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition-colors ${
                autoSpeak
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span
                className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                  autoSpeak ? 'bg-white/30' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                    autoSpeak ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </span>
              <span>{autoSpeak ? 'Đang bật' : 'Đang tắt'}</span>
            </button>
          </div>

          {/* Voice Region Setting */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <Volume2 className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <p className="text-base font-bold text-slate-900">Chọn giọng đọc quen thuộc</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {REGION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeVoiceRegion(opt.id)}
                  className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition-colors ${
                    voiceRegion === opt.id
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <PWAInstallButton />

          {currentUser && onLogout && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <User className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">
                    {currentUser.isGuest ? 'Chế độ dùng thử nhanh' : currentUser.displayName}
                  </p>
                  {!currentUser.isGuest && (
                    <p className="text-xs tabular-nums text-slate-600">{currentUser.phone}</p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onLogout();
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>{currentUser.isGuest ? 'Đăng nhập' : 'Đổi tài khoản'}</span>
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFamilySettings();
                }}
                className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Số SOS &amp; Gia đình
              </button>
              {onOpenGuide && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenGuide();
                  }}
                  className="min-h-[44px] rounded-xl border border-blue-200 bg-blue-50 px-3.5 text-sm font-bold text-blue-900 hover:bg-blue-100"
                >
                  Hướng dẫn sử dụng
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] rounded-xl bg-blue-700 px-5 text-sm font-bold text-white hover:bg-blue-800"
            >
              Xong
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
