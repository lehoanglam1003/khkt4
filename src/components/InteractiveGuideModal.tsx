import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Mic,
  QrCode,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  GUIDE_QR_SAMPLES,
  GUIDE_VOICE_SAMPLES,
  inspectGuideQrSample,
  inspectGuideVoiceSample,
  QR_GUIDE_STEPS,
  VOICE_GUIDE_STEPS,
  type GuideTopic,
} from '../shared/guideContent';
import type { AlertLevel } from '../types/safeai';

interface InteractiveGuideModalProps {
  isOpen: boolean;
  initialTopic?: GuideTopic;
  onClose: () => void;
  onGoToScanner: () => void;
  onGoToVoiceShield: () => void;
  onSpeakText: (text: string) => void;
  onStopSpeaking: () => void;
  isSpeaking: boolean;
}

function getToneClasses(level: AlertLevel) {
  if (level === 'red') {
    return {
      card: 'border-2 border-red-500 bg-red-50 text-red-950',
      badge: 'bg-red-600 text-white',
      badgeText: 'MỨC ĐỎ · NGUY HIỂM',
      Icon: ShieldAlert,
    };
  }
  if (level === 'orange') {
    return {
      card: 'border-2 border-orange-500 bg-orange-50 text-orange-950',
      badge: 'bg-orange-500 text-white',
      badgeText: 'MỨC CAM · CẢNH GIÁC',
      Icon: AlertTriangle,
    };
  }
  return {
    card: 'border-2 border-emerald-500 bg-emerald-50 text-emerald-950',
    badge: 'bg-emerald-600 text-white',
    badgeText: 'MỨC XANH · AN TOÀN',
    Icon: ShieldCheck,
  };
}

export function InteractiveGuideModal({
  isOpen,
  initialTopic = 'qr',
  onClose,
  onGoToScanner,
  onGoToVoiceShield,
  onSpeakText,
  onStopSpeaking,
  isSpeaking,
}: InteractiveGuideModalProps) {
  const [topic, setTopic] = useState<GuideTopic>(initialTopic);
  const [activeStepIdx, setActiveStepIdx] = useState<number>(0);
  const [selectedQrId, setSelectedQrId] = useState<string>(GUIDE_QR_SAMPLES[0].id);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(GUIDE_VOICE_SAMPLES[0].id);

  useEffect(() => {
    if (isOpen) {
      setTopic(initialTopic);
      setActiveStepIdx(0);
    }
  }, [isOpen, initialTopic]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const qrResult = useMemo(() => {
    const sample = GUIDE_QR_SAMPLES.find((s) => s.id === selectedQrId) ?? GUIDE_QR_SAMPLES[0];
    return inspectGuideQrSample(sample);
  }, [selectedQrId]);

  const voiceResult = useMemo(() => {
    const sample =
      GUIDE_VOICE_SAMPLES.find((s) => s.id === selectedVoiceId) ?? GUIDE_VOICE_SAMPLES[0];
    return inspectGuideVoiceSample(sample);
  }, [selectedVoiceId]);

  if (!isOpen) return null;

  const steps = topic === 'qr' ? QR_GUIDE_STEPS : VOICE_GUIDE_STEPS;
  const activeStep = steps[activeStepIdx] ?? steps[0];

  const handleToggleSpeak = () => {
    if (isSpeaking) {
      onStopSpeaking();
      return;
    }
    const header =
      topic === 'qr'
        ? 'Hướng dẫn cách quét mã QR và VietQR trên SafeAI.'
        : 'Hướng dẫn cách nhận diện giọng nói và Lá chắn cuộc gọi trên SafeAI.';
    const body = steps
      .map((s) => `${s.title}. ${s.summary} Mẹo cho Cụ: ${s.tipForSeniors}`)
      .join(' ');
    onSpeakText(`${header} ${body}`);
  };

  const qrTone = getToneClasses(qrResult.alertLevel);
  const voiceTone = getToneClasses(voiceResult.alertLevel);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-2.5 backdrop-blur-xs sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="interactive-guide-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Pinned Modal Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white sm:h-11 sm:w-11">
              <BookOpen className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2
                id="interactive-guide-title"
                className="text-base font-extrabold leading-snug text-[#0F294A] sm:text-xl"
              >
                Hướng dẫn tương tác: Quét QR &amp; Nhận diện Giọng nói
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">
                Bấm từng bước và thử trực tiếp để xem SafeAI bóc tách lừa đảo như thế nào.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleToggleSpeak}
              className={`inline-flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 text-xs font-bold transition-colors sm:px-3.5 sm:text-sm ${
                isSpeaking
                  ? 'border-red-500 bg-red-50 text-red-800 hover:bg-red-100'
                  : 'border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-100'
              }`}
            >
              {isSpeaking ? (
                <>
                  <VolumeX className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="sm:hidden">Dừng</span>
                  <span className="hidden sm:inline">Dừng đọc</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="sm:hidden">Nghe đọc</span>
                  <span className="hidden sm:inline">Nghe đọc hướng dẫn</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng hướng dẫn tương tác"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Pinned Topic Switcher */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 sm:px-6">
          <div
            role="tablist"
            aria-label="Chọn chủ đề hướng dẫn"
            className="grid grid-cols-2 gap-1.5 rounded-xl bg-slate-200/70 p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={topic === 'qr'}
              onClick={() => {
                setTopic('qr');
                setActiveStepIdx(0);
              }}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors sm:gap-2 sm:px-4 sm:text-base ${
                topic === 'qr'
                  ? 'bg-white text-[#0F294A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="h-4 w-4 shrink-0 text-blue-700 sm:h-5 sm:w-5" aria-hidden="true" />
              <span>Cách quét QR &amp; VietQR</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={topic === 'voice'}
              onClick={() => {
                setTopic('voice');
                setActiveStepIdx(0);
              }}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition-colors sm:gap-2 sm:px-4 sm:text-base ${
                topic === 'voice'
                  ? 'bg-white text-[#0F294A] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Mic className="h-4 w-4 shrink-0 text-blue-700 sm:h-5 sm:w-5" aria-hidden="true" />
              <span>Nhận diện giọng nói &amp; Cuộc gọi</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body: 2-Column Side-by-Side on Desktop, Stacked on Mobile */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
            {/* Left Column: Interactive 3-Step Walkthrough */}
            <div className="lg:col-span-6">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 sm:text-sm">
                Bấm từng bước để xem cách hoạt động
              </p>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                {steps.map((step, idx) => {
                  const isSelected = idx === activeStepIdx;
                  return (
                    <button
                      key={step.stepNumber}
                      type="button"
                      onClick={() => setActiveStepIdx(idx)}
                      aria-current={isSelected ? 'step' : undefined}
                      className={`flex min-h-[48px] items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? 'border-blue-700 bg-blue-50 text-[#0F294A]'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-extrabold ${
                          isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {step.stepNumber}
                      </span>
                      <span className="text-sm font-bold leading-snug">
                        {step.title.replace(/^Bước \d:\s*/i, '')}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 rounded-2xl border border-blue-200 bg-slate-50 p-4">
                <h3 className="text-base font-extrabold text-[#0F294A] sm:text-lg">
                  {activeStep.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-800 sm:text-base">
                  {activeStep.summary}
                </p>
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-950">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" />
                  <span>Lời khuyên cho Cụ: {activeStep.tipForSeniors}</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Interactive Playground */}
            <div className="border-t border-slate-200 pt-4 lg:col-span-6 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <h3 className="text-base font-extrabold text-[#0F294A] sm:text-lg">
                  {topic === 'qr'
                    ? 'Thử ngay: Bóc tách mã QR thật'
                    : 'Thử ngay: Bắt câu nói lừa đảo'}
                </h3>
              </div>
              <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                {topic === 'qr'
                  ? 'Cụ bấm chọn một tình huống bên dưới để thấy rõ dữ liệu ẩn bên trong mã QR.'
                  : 'Cụ bấm vào một câu nói mẫu để xem SafeAI phản ứng ngay lập tức.'}
              </p>

              {topic === 'qr' ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {GUIDE_QR_SAMPLES.map((sample) => {
                      const selected = sample.id === selectedQrId;
                      return (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => setSelectedQrId(sample.id)}
                          className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${
                            selected
                              ? 'border-blue-700 bg-blue-700 text-white'
                              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          {sample.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className={`rounded-2xl p-4 ${qrTone.card}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-extrabold ${qrTone.badge}`}
                      >
                        <qrTone.Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{qrTone.badgeText}</span>
                      </span>
                      <span className="font-mono text-xs opacity-80">
                        {qrResult.vietQr ? 'Chuẩn VietQR / EMVCo' : 'Chuẩn đường link URL'}
                      </span>
                    </div>

                    <p className="mt-2.5 text-base font-extrabold">{qrResult.headline}</p>
                    <p className="mt-1 text-sm leading-relaxed">{qrResult.sample.contextNote}</p>

                    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                      {qrResult.tagBreakdown.map((item) => (
                        <div key={item.tag} className="rounded-xl bg-white/90 px-3 py-2 text-slate-900">
                          <dt className="text-xs font-bold text-slate-500">
                            {item.tag} · {item.meaning}
                          </dt>
                          <dd className="mt-0.5 text-sm font-bold break-all">{item.value}</dd>
                        </div>
                      ))}
                    </dl>

                    {qrResult.reasons.length > 0 && (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-medium">
                        {qrResult.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {GUIDE_VOICE_SAMPLES.map((sample) => {
                      const selected = sample.id === selectedVoiceId;
                      return (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => setSelectedVoiceId(sample.id)}
                          className={`min-h-[44px] rounded-xl border px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${
                            selected
                              ? 'border-blue-700 bg-blue-700 text-white'
                              : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                          }`}
                        >
                          {sample.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className={`rounded-2xl p-4 ${voiceTone.card}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-extrabold ${voiceTone.badge}`}
                      >
                        <voiceTone.Icon className="h-4 w-4" aria-hidden="true" />
                        <span>{voiceTone.badgeText}</span>
                      </span>
                    </div>

                    <p className="mt-2.5 rounded-xl bg-white/90 p-3 text-sm italic text-slate-900">
                      &ldquo;{voiceResult.sample.transcript}&rdquo;
                    </p>

                    <p className="mt-2.5 text-base font-extrabold">{voiceResult.headline}</p>
                    <p className="mt-1 text-sm leading-relaxed">{voiceResult.advice}</p>

                    {voiceResult.matchedKeywords.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold">Cụm từ hệ thống bắt được:</span>
                        {voiceResult.matchedKeywords.map((kw) => (
                          <span
                            key={kw}
                            className="rounded-md bg-white/90 px-2 py-0.5 text-xs font-bold text-slate-900"
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pinned Footer Action */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2.5 border-t border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-3.5">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Đóng hướng dẫn
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              if (topic === 'qr') {
                onGoToScanner();
              } else {
                onGoToVoiceShield();
              }
            }}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800 sm:px-5"
          >
            <span>
              {topic === 'qr'
                ? 'Thực hành ngay ở mục Kiểm tra QR'
                : 'Thực hành ngay ở Lá chắn Giọng nói'}
            </span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
