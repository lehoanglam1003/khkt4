import { useState } from 'react';
import { Download, Share, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../hooks/usePWAInstall';

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-semibold text-amber-950"
    >
      <span className="inline-flex items-center gap-2">
        <WifiOff className="h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" />
        <span>
          Đang mất mạng — SafeAI vẫn hoạt động ngoại tuyến để giải mã QR VietQR, tra cứu quy tắc lừa đảo và mở Phanh khẩn cấp.
        </span>
      </span>
    </div>
  );
}

interface PWAInstallButtonProps {
  compact?: boolean;
}

export function PWAInstallButton({ compact = false }: PWAInstallButtonProps) {
  const { canPromptInstall, isInstalled, isIos, promptInstall } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);

  if (isInstalled) {
    if (compact) return null;
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">
        SafeAI đã được cài đặt như ứng dụng trên thiết bị này.
      </div>
    );
  }

  const handleClick = async () => {
    if (canPromptInstall) {
      const outcome = await promptInstall();
      if (outcome !== 'accepted') {
        setGuideOpen(true);
      }
    } else {
      setGuideOpen(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void handleClick()}
        aria-label="Cài ứng dụng SafeAI về màn hình chính"
        className={
          compact
            ? 'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-bold text-blue-800 transition-colors hover:bg-blue-100 sm:min-h-[44px] sm:px-3 sm:text-sm'
            : 'inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-bold text-blue-900 transition-colors hover:bg-blue-100'
        }
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className={compact ? 'hidden lg:inline' : ''}>
          {compact ? 'Cài App' : 'Cài SafeAI ra Màn hình chính (dùng như App & Chia sẻ từ Zalo)'}
        </span>
      </button>

      {guideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setGuideOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-install-guide-title"
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="h-6 w-6 text-blue-700" aria-hidden="true" />
                <h3 id="pwa-install-guide-title" className="text-lg font-bold text-slate-900">
                  Cài đặt SafeAI lên điện thoại
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="Đóng hướng dẫn cài đặt ứng dụng"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isIos ? (
              <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-base text-slate-800">
                <li>
                  Trên Safari (iPhone/iPad), bấm nút <strong className="inline-flex items-center gap-1"><Share className="h-4 w-4" /> Chia sẻ</strong> ở thanh dưới cùng.
                </li>
                <li>Kéo xuống chọn mục <strong>&quot;Thêm vào MH chính&quot; (Add to Home Screen)</strong>.</li>
                <li>Bấm <strong>Thêm</strong> ở góc trên phải — biểu tượng SafeAI sẽ nằm gọn trên màn hình chính.</li>
              </ol>
            ) : (
              <ol className="mt-4 list-decimal space-y-2.5 pl-5 text-base text-slate-800">
                <li>Trên Chrome/Edge điện thoại, bấm menu <strong>⋮ (3 chấm)</strong> ở góc trên phải.</li>
                <li>Chọn <strong>&quot;Cài đặt ứng dụng&quot; (Install app)</strong> hoặc <strong>&quot;Thêm vào Màn hình chính&quot;</strong>.</li>
                <li>Sau khi cài trên Android, Cụ có thể bấm <strong>Chia sẻ ảnh từ Zalo -&gt; chọn SafeAI</strong> để kiểm tra lừa đảo trực tiếp!</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setGuideOpen(false)}
              className="mt-5 min-h-[44px] w-full rounded-xl bg-blue-700 text-base font-bold text-white hover:bg-blue-800"
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}
    </>
  );
}
