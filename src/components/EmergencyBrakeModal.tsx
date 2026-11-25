import { useEffect, useState } from 'react';
import {
  CheckSquare,
  Clock,
  Hand,
  PhoneCall,
  Square,
  Unlock,
  Volume2,
  X,
} from 'lucide-react';
import { EMERGENCY_SITUATIONS } from '../shared/trainingData';
import type { DiaryEntry, VoiceRegion } from '../types/safeai';

interface EmergencyBrakeModalProps {
  isOpen: boolean;
  entry: DiaryEntry | null;
  sosNumbers: [string, string];
  voiceRegion: VoiceRegion;
  onChangeVoiceRegion: (region: VoiceRegion) => void;
  onClose: () => void;
  onSaveProgress: (entryId: string | null, situationKey: string, checklist: string[]) => void;
  onSpeakText: (text: string, regionOverride?: VoiceRegion) => void;
  onOpenRecoveryWizard?: () => void;
  onOpenContacts?: () => void;
}

const VOICE_REGIONS: { id: VoiceRegion; label: string }[] = [
  { id: 'auto', label: 'Tự động' },
  { id: 'bac', label: 'Miền Bắc' },
  { id: 'trung', label: 'Miền Trung' },
  { id: 'nam', label: 'Miền Nam' },
];

export function EmergencyBrakeModal({
  isOpen,
  entry,
  sosNumbers,
  voiceRegion,
  onChangeVoiceRegion,
  onClose,
  onSaveProgress,
  onSpeakText,
  onOpenRecoveryWizard,
  onOpenContacts,
}: EmergencyBrakeModalProps) {
  const [situationKey, setSituationKey] = useState<string>(
    entry?.situationKey || EMERGENCY_SITUATIONS[0].key
  );
  const [checkedItems, setCheckedItems] = useState<string[]>(entry?.checklist ?? []);
  const [stepIndex, setStepIndex] = useState(0);
  const [savedNotice, setSavedNotice] = useState('');
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(60);
  const [unlockedEarly, setUnlockedEarly] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setSituationKey(entry?.situationKey || EMERGENCY_SITUATIONS[0].key);
    setCheckedItems(entry?.checklist ?? []);
    setStepIndex(0);
    setSavedNotice('');
    // Activate 60-second cooling-off lock automatically on Red alerts or SOS triggers
    const shouldLock = !entry || entry.alertLevel === 'red';
    setCooldownSeconds(shouldLock ? 60 : 0);
    setUnlockedEarly(!shouldLock);
  }, [isOpen, entry]);

  useEffect(() => {
    if (!isOpen || unlockedEarly || cooldownSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setUnlockedEarly(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, unlockedEarly, cooldownSeconds]);

  if (!isOpen) return null;

  const activeSituation =
    EMERGENCY_SITUATIONS.find((s) => s.key === situationKey) ?? EMERGENCY_SITUATIONS[0];

  const toggleItem = (item: string) => {
    setCheckedItems((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const handleReadStep = (index: number) => {
    const steps = [activeSituation.nextStep, ...activeSituation.checklist];
    const safeIdx = index % steps.length;
    setStepIndex(safeIdx);
    onSpeakText(steps[safeIdx], voiceRegion);
  };

  const handleSave = () => {
    onSaveProgress(entry?.id ?? null, situationKey, checkedItems);
    setSavedNotice('Đã lưu tiến độ xử lý vào Nhật ký.');
    setTimeout(() => setSavedNotice(''), 3000);
  };

  const validSos = sosNumbers.map((s) => s.trim()).filter(Boolean);
  const isCoolingDown = !unlockedEarly && cooldownSeconds > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="brake-modal-title"
    >
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-700">
              <Hand className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="brake-modal-title" className="text-xl font-bold text-slate-900">
                Dừng lại, xử lý từng bước
              </h2>
              <p className="text-sm text-slate-600">
                Bình tĩnh làm theo từng mục bên dưới — không vội chuyển tiền hay đọc OTP.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại phanh khẩn cấp"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 60-Second Cooling-Off Friction Barrier */}
        {isCoolingDown && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-red-900">
                <Clock className="h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
                <span className="text-base font-bold">
                  Khóa bình tĩnh: Tạm dừng{' '}
                  <span className="font-mono tabular-nums">{cooldownSeconds}s</span> trước khi thao tác
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUnlockedEarly(true);
                  setCooldownSeconds(0);
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-sm font-semibold text-red-800 hover:bg-red-100"
              >
                <Unlock className="h-4 w-4" aria-hidden="true" />
                <span>Tôi đã bình tĩnh, mở khóa ngay</span>
              </button>
            </div>
            <p className="mt-2 text-base text-red-950">
              Kẻ gian luôn hù dọa "khóa tài khoản sau vài phút" để Cụ hoảng loạn. Cụ hãy hít thở sâu 4 giây, uống ngụm nước và tuyệt đối không mở ứng dụng ngân hàng trong lúc đang nói chuyện điện thoại.
            </p>
          </div>
        )}

        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-base font-semibold text-red-900">
          Không chuyển thêm tiền, không cung cấp mã OTP/mật khẩu và không cài ứng dụng lạ theo hướng dẫn của người gọi.
        </div>

        {/* Regional Voice Preference Selector */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <span className="text-sm font-semibold text-slate-800">Giọng đọc hướng dẫn:</span>
          <div className="flex flex-wrap gap-1.5">
            {VOICE_REGIONS.map((reg) => (
              <button
                key={reg.id}
                type="button"
                onClick={() => onChangeVoiceRegion(reg.id)}
                className={`min-h-[36px] rounded-lg border px-3 text-sm font-semibold transition-colors ${
                  voiceRegion === reg.id
                    ? 'border-blue-600 bg-blue-700 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
              >
                {reg.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="brake-situation-select" className="block text-base font-semibold text-slate-900">
            Tình huống hiện tại của Cụ:
          </label>
          <select
            id="brake-situation-select"
            value={situationKey}
            onChange={(e) => {
              setSituationKey(e.target.value);
              setStepIndex(0);
            }}
            className="mt-2 min-h-[48px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900"
          >
            {EMERGENCY_SITUATIONS.map((sit) => (
              <option key={sit.key} value={sit.key}>
                {sit.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Việc ưu tiên trước mắt</p>
          <p className="mt-1 text-base leading-relaxed text-amber-950">{activeSituation.nextStep}</p>
        </div>

        <div className="mt-5 space-y-2.5">
          <p className="text-base font-semibold text-slate-900">Các bước thực hiện</p>
          {activeSituation.checklist.map((item) => {
            const checked = checkedItems.includes(item);
            return (
              <button
                key={item}
                type="button"
                onClick={() => toggleItem(item)}
                className={`flex min-h-[48px] w-full items-start gap-3 rounded-xl border p-3.5 text-left text-base transition-colors ${
                  checked
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'
                }`}
              >
                {checked ? (
                  <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Square className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                )}
                <span>{item}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => handleReadStep(stepIndex)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-base font-semibold text-slate-800 hover:bg-slate-50"
          >
            <Volume2 className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <span>Nghe bước {stepIndex + 1}</span>
          </button>
          <button
            type="button"
            onClick={() => handleReadStep(stepIndex + 1)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-base font-semibold text-slate-800 hover:bg-slate-50"
          >
            <span>Đọc bước tiếp theo</span>
          </button>
        </div>

        {validSos.length > 0 ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Gọi nhanh người thân đã lưu</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {validSos.map((num, idx) => (
                <a
                  key={num + idx}
                  href={`tel:${num}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-base font-semibold text-white hover:bg-red-700"
                >
                  <PhoneCall className="h-4 w-4" aria-hidden="true" />
                  <span>Gọi người thân {idx + 1}: {num}</span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-800">
              Chưa lưu số người thân — có thể gọi khẩn cấp ngay hoặc thêm số con cháu:
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <a
                href="tel:113"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-red-700 px-4 py-2 text-base font-bold text-white hover:bg-red-800"
              >
                <PhoneCall className="h-4 w-4" aria-hidden="true" />
                <span>Gọi Công an 113</span>
              </a>
              {onOpenContacts && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenContacts();
                  }}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100"
                >
                  <span>Lưu số người thân (SOS)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {onOpenRecoveryWizard && (
          <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenRecoveryWizard();
              }}
              className="min-h-[44px] w-full rounded-xl bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800"
            >
              Tôi lỡ chuyển tiền / bấm link mất rồi — Mở Cấp cứu &quot;Giờ vàng&quot;
            </button>
          </div>
        )}

        {savedNotice && (
          <p className="mt-4 text-sm font-semibold text-emerald-700" role="status">
            {savedNotice}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-300 px-5 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50"
          >
            Đóng
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="min-h-[44px] rounded-xl bg-blue-700 px-5 py-2 text-base font-semibold text-white hover:bg-blue-800"
          >
            Lưu tiến độ vào Nhật ký
          </button>
        </div>
      </div>
    </div>
  );
}
