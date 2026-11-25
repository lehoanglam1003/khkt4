import { useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon,
  Check,
  CheckSquare,
  Copy,
  FileText,
  PhoneCall,
  ShieldAlert,
  Square,
  X,
} from 'lucide-react';
import {
  buildIncidentReportText,
  detectMentionedBanks,
  GOLDEN_HOUR_CHECKLIST,
} from '../shared/recoveryGuide';
import { VIETNAM_BANKS } from '../shared/vietqrParser';
import type { ScanResult } from '../types/safeai';

interface RecoveryWizardModalProps {
  isOpen: boolean;
  scan: ScanResult | null;
  sosNumbers: [string, string];
  onClose: () => void;
}

export function RecoveryWizardModal({
  isOpen,
  scan,
  sosNumbers,
  onClose,
}: RecoveryWizardModalProps) {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [selectedBankBin, setSelectedBankBin] = useState<string>('');
  const [amountLost, setAmountLost] = useState<string>('');
  const [victimNotes, setVictimNotes] = useState<string>('');
  const [copiedReport, setCopiedReport] = useState(false);

  const detectedBanks = useMemo(() => detectMentionedBanks(scan), [scan]);

  useEffect(() => {
    if (!isOpen) return;
    setCopiedReport(false);
    if (detectedBanks.length > 0) {
      setSelectedBankBin(detectedBanks[0].bin);
    } else {
      setSelectedBankBin(VIETNAM_BANKS[0].bin);
    }
    if (scan?.vietQr?.amountFormatted) {
      setAmountLost(scan.vietQr.amountFormatted);
    }
  }, [isOpen, detectedBanks, scan]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const selectedBank = VIETNAM_BANKS.find((b) => b.bin === selectedBankBin) ?? VIETNAM_BANKS[0];
  const validSos = sosNumbers.map((s) => s.trim()).filter(Boolean);
  const reportText = buildIncidentReportText(scan, victimNotes, amountLost);

  const toggleStep = (id: string) => {
    setCheckedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCopyReport = async () => {
    try {
      await navigator.clipboard.writeText(reportText);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3000);
    } catch {
      // fallback ignored
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-wizard-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border-2 border-red-500 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-red-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
              <AlertOctagon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="recovery-wizard-title" className="text-xl font-extrabold text-red-900">
                Cấp cứu &quot;Giờ vàng&quot; sau khi lỡ chuyển tiền / bấm link
              </h2>
              <p className="mt-0.5 text-sm text-slate-700">
                Bình tĩnh làm ngay 4 bước dưới đây trong 15 phút đầu để tăng cơ hội khóa tài khoản kịp thời.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hướng dẫn cấp cứu giờ vàng"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Immediate Bank Hotline + Police 113 + SOS */}
        <div className="mt-5 rounded-2xl border-2 border-red-300 bg-red-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-red-900">
                Gọi khóa tài khoản ngân hàng 24/7 ngay lập tức
              </p>
              {detectedBanks.length > 0 && (
                <p className="text-xs font-semibold text-red-800">
                  SafeAI tự nhận diện ngân hàng liên quan: {detectedBanks.map((b) => b.shortName).join(', ')}
                </p>
              )}
            </div>
            <a
              href="tel:113"
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-red-700 px-4 text-sm font-bold text-white hover:bg-red-800"
            >
              <PhoneCall className="h-4 w-4" aria-hidden="true" />
              <span>Gọi khẩn cấp 113</span>
            </a>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-12">
            <div className="sm:col-span-6">
              <label htmlFor="recovery-bank-select" className="block text-xs font-bold text-red-950">
                Chọn ngân hàng Cụ đang sử dụng để khóa thẻ:
              </label>
              <select
                id="recovery-bank-select"
                value={selectedBank.bin}
                onChange={(e) => setSelectedBankBin(e.target.value)}
                className="mt-1 min-h-[44px] w-full rounded-xl border border-red-300 bg-white px-3 text-sm font-semibold text-slate-900"
              >
                {VIETNAM_BANKS.map((bank) => (
                  <option key={bank.bin} value={bank.bin}>
                    {bank.shortName} — Tổng đài: {bank.hotline}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end sm:col-span-6">
              <a
                href={`tel:${selectedBank.hotline.replace(/\s+/g, '')}`}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-red-600 px-4 text-sm font-bold tabular-nums text-white hover:bg-red-700"
              >
                <PhoneCall className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Gọi {selectedBank.shortName}: {selectedBank.hotline}</span>
              </a>
            </div>
          </div>

          {validSos.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-red-200 pt-3">
              {validSos.map((num, idx) => (
                <a
                  key={num + idx}
                  href={`tel:${num}`}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 text-sm font-bold text-red-800 hover:bg-red-100"
                >
                  <PhoneCall className="h-4 w-4" aria-hidden="true" />
                  <span>Gọi người thân {idx + 1}: {num}</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* 4-Step Golden Hour Checklist (including .apk & Accessibility removal) */}
        <div className="mt-5 space-y-2.5">
          <p className="text-base font-bold text-slate-900">Các bước tự cứu khẩn cấp (bấm đánh dấu khi xong):</p>
          {GOLDEN_HOUR_CHECKLIST.map((step) => {
            const checked = checkedIds.includes(step.id);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => toggleStep(step.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                  checked
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                    : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'
                }`}
              >
                {checked ? (
                  <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                ) : (
                  <Square className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                )}
                <div>
                  <p className="text-base font-bold">{step.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-slate-700">{step.detail}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Exportable Police / Bank Incident Report */}
        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-slate-900">
            <FileText className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h3 className="text-base font-bold">Biên bản tóm tắt trình báo Công an &amp; Ngân hàng</h3>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            SafeAI đã điền sẵn số tài khoản, link và dấu hiệu từ lượt quét vừa rồi để Cụ đưa cho con cháu hoặc Công an phường.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="recovery-amount" className="block text-xs font-semibold text-slate-700">
                Số tiền đã chuyển (nếu có)
              </label>
              <input
                id="recovery-amount"
                type="text"
                value={amountLost}
                onChange={(e) => setAmountLost(e.target.value)}
                placeholder="Ví dụ: 5.000.000 đ"
                className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
            <div>
              <label htmlFor="recovery-notes" className="block text-xs font-semibold text-slate-700">
                Ghi chú thêm (tên đối tượng, thời gian)
              </label>
              <input
                id="recovery-notes"
                type="text"
                value={victimNotes}
                onChange={(e) => setVictimNotes(e.target.value)}
                placeholder="Ví dụ: Gọi lúc 9h15 xưng công an..."
                className="mt-1 min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              />
            </div>
          </div>

          <pre className="mt-3 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-3 font-mono text-xs leading-relaxed text-slate-800">
            {reportText}
          </pre>

          <div className="mt-3 flex flex-wrap justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <ShieldAlert className="h-4 w-4 text-orange-600" aria-hidden="true" />
              <span>Không giữ bí mật — hãy báo ngay cho con cháu và cơ quan chức năng.</span>
            </span>
            <button
              type="button"
              onClick={() => void handleCopyReport()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800"
            >
              {copiedReport ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copiedReport ? 'Đã sao chép biên bản!' : 'Sao chép biên bản trình báo'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
