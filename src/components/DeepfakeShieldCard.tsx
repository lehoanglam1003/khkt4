import { useState } from 'react';
import {
  CheckSquare,
  FileVideo,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Square,
  Video,
} from 'lucide-react';
import type { DeepfakeInspectResult } from '../types/safeai';

const LOCAL_CHALLENGE_TESTS = [
  {
    id: 'turn-head',
    title: 'Phép thử 1: Yêu cầu xoay đầu 90° sang trái/phải',
    instruction: 'Bảo người gọi quay nghiêng hẳn mặt sang một bên trong 3 giây.',
    whyItWorks: 'Deepfake ghép mặt thường bị nhòe viền tai, méo kính mắt hoặc rách hình khi xoay nghiêng.',
  },
  {
    id: 'wave-hand',
    title: 'Phép thử 2: Yêu cầu vẫy tay che ngang trước mũi',
    instruction: 'Nhờ người gọi vẫy bàn tay qua lại sát trước mặt và đọc 1 câu ngẫu nhiên.',
    whyItWorks: 'AI giả mặt thường không xử lý kịp bàn tay đi ngang, làm khuôn mặt bị giật hoặc biến mất.',
  },
  {
    id: 'family-secret',
    title: 'Phép thử 3: Hỏi "Mật khẩu gia đình" & gọi lại số cũ',
    instruction: 'Tắt cuộc gọi video lạ và tự gọi lại số điện thoại cũ của con cháu trong danh bạ.',
    whyItWorks: 'Clip ghép hoặc AI giả giọng không thể trả lời kỷ niệm riêng hay nhận cuộc gọi ngược vào SIM thật.',
  },
];

export function DeepfakeShieldCard() {
  const [checkedTests, setCheckedTests] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [result, setResult] = useState<DeepfakeInspectResult | null>(null);
  const [inspectError, setInspectError] = useState('');

  const toggleTest = (id: string) => {
    setCheckedTests((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  async function handleInspect() {
    if (isInspecting) return;
    if (!selectedFile && !note.trim()) {
      setInspectError('Cụ hãy chọn đoạn video/ghi âm hoặc mô tả ngắn dấu hiệu cuộc gọi video.');
      return;
    }
    setInspectError('');
    setIsInspecting(true);
    try {
      let mediaBase64 = '';
      let mimeType = '';
      if (selectedFile) {
        if (selectedFile.size > 8 * 1024 * 1024) {
          throw new Error('Tệp vượt quá 8 MB. Cụ hãy cắt đoạn ngắn hơn hoặc mô tả dấu hiệu bên dưới.');
        }
        mediaBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Không đọc được tệp đã chọn.'));
          reader.readAsDataURL(selectedFile);
        });
        mimeType = selectedFile.type || 'video/mp4';
      }

      const res = await fetch('/api/deepfake/inspect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaBase64,
          mimeType,
          fileName: selectedFile?.name ?? '',
          note: note.trim(),
        }),
      });
      const data = (await res.json()) as DeepfakeInspectResult & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Chưa thể kiểm tra đoạn video/âm thanh.');
      setResult(data);
    } catch (err) {
      setInspectError(err instanceof Error ? err.message : 'Lỗi kiểm tra Deepfake.');
    } finally {
      setIsInspecting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
      <div className="flex items-center gap-2.5">
        <Video className="h-5 w-5 text-blue-700" aria-hidden="true" />
        <h2 className="text-lg font-bold text-[#0F294A]">Lá chắn Video / Giọng nói Deepfake</h2>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        Kẻ gian có thể ghép mặt hoặc giả giọng người thân gọi Zalo 5–10 giây rồi giục chuyển tiền. Áp dụng ngay <strong>3 phép thử phá Deepfake tại chỗ</strong>:
      </p>

      <div className="mt-3 space-y-2">
        {LOCAL_CHALLENGE_TESTS.map((t) => {
          const checked = checkedTests.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => toggleTest(t.id)}
              className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition-colors ${
                checked
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                  : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'
              }`}
            >
              {checked ? (
                <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
              ) : (
                <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold">{t.title}</p>
                <p className="mt-0.5 text-xs text-slate-700">{t.instruction}</p>
                <p className="mt-0.5 text-[11px] text-slate-500">{t.whyItWorks}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2.5 border-t border-slate-100 pt-4">
        <label htmlFor="deepfake-note-input" className="block text-xs font-bold text-slate-700">
          Kiểm tra đoạn clip / mô tả cuộc gọi video bất thường (tùy chọn):
        </label>
        <input
          id="deepfake-note-input"
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Gọi video mờ mặt bảo tai nạn cấp cứu, tắt sớm..."
          className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3 text-sm"
        />

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-[40px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 hover:bg-slate-100">
            <FileVideo className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <span className="truncate">
              {selectedFile ? selectedFile.name : 'Chọn video / âm thanh (<8MB)'}
            </span>
            <input
              type="file"
              accept="video/*,audio/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                e.target.value = '';
                setSelectedFile(f);
              }}
            />
          </label>
          <button
            type="button"
            disabled={isInspecting}
            onClick={() => void handleInspect()}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {isInspecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <span>Kiểm tra dấu hiệu</span>
          </button>
        </div>

        {inspectError && (
          <p className="text-xs font-semibold text-red-700" role="alert">
            {inspectError}
          </p>
        )}

        {result && (
          <div
            role="status"
            className={`rounded-xl border p-3 text-xs ${
              result.riskLevel === 'red'
                ? 'border-red-400 bg-red-50 text-red-950'
                : result.riskLevel === 'green'
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-950'
                  : 'border-orange-400 bg-orange-50 text-orange-950'
            }`}
          >
            <div className="flex items-start gap-2">
              {result.riskLevel === 'green' ? (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
              ) : (
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
              )}
              <div>
                <p className="font-bold">
                  {result.analyzedWithAi ? 'Phân tích AI đa phương thức:' : 'Đánh giá nhanh & đối chiếu:'}
                </p>
                <p className="mt-0.5 leading-relaxed">{result.summary}</p>
                {result.indicators.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-4">
                    {result.indicators.map((ind) => (
                      <li key={ind}>{ind}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
