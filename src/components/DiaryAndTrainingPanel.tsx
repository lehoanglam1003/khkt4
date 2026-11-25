import { useMemo, useState } from 'react';
import {
  Award,
  BarChart3,
  CheckCircle2,
  Download,
  Hand,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { sortScenariosForUser, TRAINING_SCENARIOS } from '../shared/trainingData';
import { VoiceScamSimulator } from './VoiceScamSimulator';
import type {
  BenchmarkReport,
  DiaryEntry,
  TrainingProgress,
  TrainingScenario,
} from '../types/safeai';

interface DiaryAndTrainingPanelProps {
  entries: DiaryEntry[];
  onUpdateEntry: (id: string, patch: Partial<DiaryEntry>) => void;
  onDeleteEntry: (id: string) => void;
  onOpenEmergencyBrake: (entry: DiaryEntry) => void;
  trainingProgress: Record<string, TrainingProgress>;
  onRecordTrainingAttempt: (scenarioId: string, correct: boolean) => void;
  onSpeakText?: (text: string) => void;
}

const STATUS_LABELS: Record<DiaryEntry['status'], string> = {
  moi_ghi_nhan: 'Mới ghi nhận',
  dang_xu_ly: 'Đang xử lý',
  da_an_toan: 'Đã an toàn',
};

const LEVEL_LABELS: Record<
  DiaryEntry['alertLevel'],
  { text: string; badgeClass: string; cardClass: string }
> = {
  red: {
    text: 'Nguy hiểm (Đỏ)',
    badgeClass: 'bg-red-600 text-white',
    cardClass: 'border-red-300 bg-red-50/45',
  },
  orange: {
    text: 'Đáng ngờ (Cam)',
    badgeClass: 'bg-orange-500 text-white',
    cardClass: 'border-orange-300 bg-orange-50/45',
  },
  green: {
    text: 'An toàn (Xanh)',
    badgeClass: 'bg-emerald-600 text-white',
    cardClass: 'border-emerald-300 bg-emerald-50/45',
  },
};

const CATEGORY_LABELS: Record<TrainingScenario['categoryTag'], string> = {
  otp: 'Lừa đọc OTP / Công an',
  receipt: 'Biên lai giả / Phí giải ngân',
  qr: 'Mã QR / Cài tệp .APK',
  family: 'Mạo danh người thân',
};

export function DiaryAndTrainingPanel({
  entries,
  onUpdateEntry,
  onDeleteEntry,
  onOpenEmergencyBrake,
  trainingProgress,
  onRecordTrainingAttempt,
  onSpeakText,
}: DiaryAndTrainingPanelProps) {
  const [filter, setFilter] = useState<'all' | DiaryEntry['alertLevel']>('all');
  const [trainingMode, setTrainingMode] = useState<'quiz' | 'voice'>('quiz');
  const [customScenarios, setCustomScenarios] = useState<TrainingScenario[]>([]);
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);

  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [selectedChoiceIdx, setSelectedChoiceIdx] = useState<number | null>(null);
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [completedAll, setCompletedAll] = useState(false);

  // KHKT Benchmark Evaluation state
  const [benchmarkReport, setBenchmarkReport] = useState<BenchmarkReport | null>(null);
  const [isRunningBenchmark, setIsRunningBenchmark] = useState(false);

  const { ordered: orderedScenarios, prioritizedCategory } = useMemo(() => {
    const combined = [...customScenarios, ...TRAINING_SCENARIOS];
    return sortScenariosForUser(combined, entries);
  }, [customScenarios, entries]);

  const filteredEntries = entries.filter((e) => (filter === 'all' ? true : e.alertLevel === filter));

  const redCount = entries.filter((e) => e.alertLevel === 'red').length;
  const orangeCount = entries.filter((e) => e.alertLevel === 'orange').length;
  const greenCount = entries.filter((e) => e.alertLevel === 'green').length;

  const scenario = orderedScenarios[scenarioIdx] ?? orderedScenarios[0];
  const selectedChoice =
    selectedChoiceIdx !== null ? scenario.choices[selectedChoiceIdx] : null;

  function handleAnswer(idx: number) {
    if (selectedChoiceIdx !== null) return;
    setSelectedChoiceIdx(idx);
    const isCorrect = scenario.choices[idx]?.correct ?? false;
    if (isCorrect) setSessionCorrect((c) => c + 1);
    onRecordTrainingAttempt(scenario.id, isCorrect);
  }

  function handleNextScenario() {
    if (scenarioIdx + 1 >= orderedScenarios.length) {
      setCompletedAll(true);
    } else {
      setScenarioIdx((i) => i + 1);
      setSelectedChoiceIdx(null);
    }
  }

  function handleRestartQuiz() {
    setScenarioIdx(0);
    setSelectedChoiceIdx(null);
    setSessionCorrect(0);
    setCompletedAll(false);
  }

  async function handleGenerateScenario() {
    if (isGeneratingScenario) return;
    setIsGeneratingScenario(true);
    try {
      const res = await fetch('/api/training/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focusCategory: prioritizedCategory ?? 'qr',
          existingTitles: orderedScenarios.map((s) => s.title),
        }),
      });
      const data = await res.json();
      if (res.ok && data.scenario) {
        setCustomScenarios((prev) => [data.scenario as TrainingScenario, ...prev]);
        setScenarioIdx(0);
        setSelectedChoiceIdx(null);
        setCompletedAll(false);
      }
    } finally {
      setIsGeneratingScenario(false);
    }
  }

  async function handleRunBenchmark() {
    if (isRunningBenchmark) return;
    setIsRunningBenchmark(true);
    try {
      const res = await fetch('/api/benchmark/run');
      if (res.ok) {
        const data = (await res.json()) as BenchmarkReport;
        setBenchmarkReport(data);
      }
    } finally {
      setIsRunningBenchmark(false);
    }
  }

  function handleExportDiary() {
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `safeai-nhat-ky-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Nhật ký kiểm tra &amp; xử lý</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm tabular-nums text-slate-600">
                <span>Tổng {entries.length} lượt ·</span>
                <span className="font-bold text-red-700">Đỏ: {redCount}</span>
                <span>·</span>
                <span className="font-bold text-orange-700">Cam: {orangeCount}</span>
                <span>·</span>
                <span className="font-bold text-emerald-700">Xanh: {greenCount}</span>
              </p>
            </div>
            {entries.length > 0 && (
              <button
                type="button"
                onClick={handleExportDiary}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 px-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Tải nhật ký</span>
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            {[
              { id: 'all', label: 'Tất cả' },
              { id: 'red', label: 'Đỏ · Nguy hiểm' },
              { id: 'orange', label: 'Cam · Đáng ngờ' },
              { id: 'green', label: 'Xanh · An toàn' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`inline-flex min-h-[44px] flex-1 items-center justify-center whitespace-nowrap rounded-lg px-3 text-sm font-semibold transition-colors ${
                  filter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {filteredEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-base text-slate-500">
                Chưa có mục nhật ký nào phù hợp. Các lượt kiểm tra ảnh, tin nhắn hoặc ghi âm sẽ tự động lưu tại đây.
              </div>
            ) : (
              filteredEntries.map((entry) => {
                const levelMeta = LEVEL_LABELS[entry.alertLevel];
                return (
                  <article key={entry.id} className={`rounded-xl border p-4 ${levelMeta.cardClass}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${levelMeta.badgeClass}`}>
                          {levelMeta.text}
                        </span>
                        <span className="font-semibold text-slate-900">{entry.scamType}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums text-slate-600">
                          {new Date(entry.createdAt).toLocaleString('vi-VN')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteEntry(entry.id)}
                        aria-label={`Xóa mục ${entry.scamType}`}
                        className="flex min-h-[40px] min-w-[40px] items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="mt-2 line-clamp-3 text-base text-slate-900">{entry.sourceText}</p>

                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`status-${entry.id}`} className="block text-xs font-semibold text-slate-600">
                          Trạng thái xử lý
                        </label>
                        <select
                          id={`status-${entry.id}`}
                          value={entry.status}
                          onChange={(e) =>
                            onUpdateEntry(entry.id, { status: e.target.value as DiaryEntry['status'] })
                          }
                          className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-2.5 text-sm text-slate-900"
                        >
                          {Object.entries(STATUS_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor={`note-${entry.id}`} className="block text-xs font-semibold text-slate-600">
                          Ghi chú của Cụ / gia đình
                        </label>
                        <input
                          id={`note-${entry.id}`}
                          type="text"
                          value={entry.notes}
                          onChange={(e) => onUpdateEntry(entry.id, { notes: e.target.value })}
                          placeholder="Ví dụ: Đã báo con trai kiểm tra..."
                          className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                        />
                      </div>
                    </div>

                    {entry.alertLevel !== 'green' && (
                      <button
                        type="button"
                        onClick={() => onOpenEmergencyBrake(entry)}
                        className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-red-600 px-3.5 text-sm font-semibold text-white hover:bg-red-700"
                      >
                        <Hand className="h-4 w-4" aria-hidden="true" />
                        <span>Mở Phanh khẩn cấp ({entry.checklist.length} bước đã xong)</span>
                      </button>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* Adaptive Anti-Scam Trainer */}
        <section className="self-start rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h2 className="text-xl font-bold text-slate-900">Tập nhận biết lừa đảo</h2>
            </div>
            <span className="text-sm font-semibold tabular-nums text-slate-600">
              Câu {Math.min(scenarioIdx + 1, orderedScenarios.length)}/{orderedScenarios.length}
            </span>
          </div>
          <p className="mt-1 text-base text-slate-600">
            {prioritizedCategory
              ? `Đang ưu tiên nhóm "${CATEGORY_LABELS[prioritizedCategory]}" dựa theo các lượt kiểm tra gần đây của Cụ.`
              : 'Luyện phản xạ an toàn qua các tình huống thực tế hay gặp tại Việt Nam.'}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTrainingMode('quiz')}
              className={`min-h-[40px] rounded-lg px-2 text-xs font-bold transition-colors sm:text-sm ${
                trainingMode === 'quiz'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Trắc nghiệm tình huống
            </button>
            <button
              type="button"
              onClick={() => setTrainingMode('voice')}
              className={`min-h-[40px] rounded-lg px-2 text-xs font-bold transition-colors sm:text-sm ${
                trainingMode === 'voice'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tập trận cuộc gọi giọng nói
            </button>
          </div>

          {trainingMode === 'voice' ? (
            <VoiceScamSimulator onSpeakText={onSpeakText} />
          ) : (
            <>
              <button
                type="button"
                disabled={isGeneratingScenario}
                onClick={() => void handleGenerateScenario()}
                className="mt-3 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60"
              >
                {isGeneratingScenario ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
                <span>Tạo tình huống luyện tập mới (AI)</span>
              </button>

              {completedAll ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
              <p className="text-lg font-bold text-emerald-950">
                Hoàn thành bài luyện tập ({sessionCorrect}/{orderedScenarios.length} câu đúng)
              </p>
              <p className="mt-2 text-base text-emerald-900">
                Cụ hãy nhớ nguyên tắc vàng: Không đọc OTP · Không bấm link lạ · Luôn gọi lại số người thân hoặc ngân hàng đã lưu sẵn.
              </p>
              <button
                type="button"
                onClick={handleRestartQuiz}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-emerald-700 px-4 text-base font-semibold text-white hover:bg-emerald-800"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Luyện lại từ đầu</span>
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-sm font-semibold text-blue-700">
                {scenario.title} · {CATEGORY_LABELS[scenario.categoryTag]}
              </p>
              <p className="mt-1.5 text-lg font-semibold leading-snug text-slate-900">{scenario.prompt}</p>

              <div className="mt-4 space-y-2.5">
                {scenario.choices.map((choice, idx) => {
                  const isSelected = selectedChoiceIdx === idx;
                  let btnStyle = 'border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100';
                  if (selectedChoiceIdx !== null) {
                    if (choice.correct) {
                      btnStyle = 'border-emerald-500 bg-emerald-50 text-emerald-950';
                    } else if (isSelected) {
                      btnStyle = 'border-red-400 bg-red-50 text-red-950';
                    }
                  }
                  return (
                    <button
                      key={choice.text}
                      type="button"
                      disabled={selectedChoiceIdx !== null}
                      onClick={() => handleAnswer(idx)}
                      className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-base font-medium transition-colors ${btnStyle}`}
                    >
                      <span>{choice.text}</span>
                      {selectedChoiceIdx !== null && choice.correct && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                      )}
                      {selectedChoiceIdx !== null && isSelected && !choice.correct && (
                        <XCircle className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedChoice && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p
                    className={`text-base font-bold ${
                      selectedChoice.correct ? 'text-emerald-800' : 'text-red-700'
                    }`}
                  >
                    {selectedChoice.correct
                      ? 'Chính xác! Đây là cách xử lý an toàn.'
                      : 'Cẩn thận! Làm vậy sẽ rất rủi ro.'}
                  </p>
                  <p className="mt-1 text-base text-slate-800">{scenario.lesson}</p>
                  <button
                    type="button"
                    onClick={handleNextScenario}
                    className="mt-3 min-h-[44px] rounded-xl bg-blue-700 px-5 text-base font-semibold text-white hover:bg-blue-800"
                  >
                    {scenarioIdx + 1 >= orderedScenarios.length ? 'Xem kết quả' : 'Tình huống tiếp theo'}
                  </button>
                </div>
              )}

              {trainingProgress[scenario.id] && (
                <p className="mt-4 text-xs tabular-nums text-slate-500">
                  Đã luyện {trainingProgress[scenario.id].attempts} lần · Điểm cao nhất:{' '}
                  {trainingProgress[scenario.id].bestScore}/1
                </p>
              )}
            </div>
          )}
            </>
          )}
        </section>
      </div>

      {/* Standardized Vietnamese Benchmark Suite (collapsed for technical inspection) */}
      <details className="rounded-2xl border border-slate-200 bg-white">
        <summary className="flex min-h-[54px] cursor-pointer items-center justify-between gap-3 px-6 py-4 text-base font-bold text-slate-900">
          <span className="inline-flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <span>Kiểm thử chuyên sâu hệ thống (dành cho kỹ thuật)</span>
          </span>
          <span className="text-sm font-medium text-slate-500">Bộ đánh giá 12 mẫu KHKT</span>
        </summary>

        <div className="border-t border-slate-100 p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Kiểm thử chuẩn hóa tiếng Việt (Bộ đánh giá KHKT)
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Đo lường tự động Độ chính xác (Accuracy), Độ nhạy phát hiện lừa đảo (Recall), Độ chuẩn (Precision) và Tỷ lệ báo nhầm (FPR) trên 12 mẫu thực tế tại Việt Nam.
              </p>
            </div>
            <button
              type="button"
              disabled={isRunningBenchmark}
              onClick={() => void handleRunBenchmark()}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-5 text-base font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isRunningBenchmark ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
              )}
              <span>Chạy kiểm thử 12 mẫu ngay</span>
            </button>
          </div>

          {benchmarkReport && (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">Độ chính xác (Accuracy)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
                    {benchmarkReport.accuracy}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">Độ nhạy (Recall)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-blue-700">
                    {benchmarkReport.recall}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">Độ chuẩn (Precision)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {benchmarkReport.precision}%
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">Báo nhầm tin sạch (FPR)</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                    {benchmarkReport.falsePositiveRate}%
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs font-bold text-slate-700">
                    <tr>
                      <th className="px-4 py-3">Tình huống kiểm thử</th>
                      <th className="px-4 py-3">Nhóm</th>
                      <th className="px-4 py-3">Kỳ vọng</th>
                      <th className="px-4 py-3">Kết quả</th>
                      <th className="px-4 py-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {benchmarkReport.results.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2.5 font-medium text-slate-900">{row.label}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.category}</td>
                        <td className="px-4 py-2.5 font-mono text-xs uppercase text-slate-700">
                          {row.expected}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs uppercase text-slate-700">
                          {row.actual}
                        </td>
                        <td className="px-4 py-2.5 font-semibold">
                          {row.passed ? (
                            <span className="text-emerald-700">Đạt</span>
                          ) : (
                            <span className="text-red-700">Chưa đạt</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
