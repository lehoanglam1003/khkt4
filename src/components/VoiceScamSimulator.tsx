import { useState } from 'react';
import {
  CheckCircle2,
  Mic,
  PhoneCall,
  RotateCcw,
  ShieldAlert,
  Square,
  Volume2,
} from 'lucide-react';
import {
  evaluateSimulatorResponse,
  VOICE_SIMULATOR_SCENARIOS,
  type SimulatorEvaluation,
} from '../shared/scamSimulator';
import { useVietnameseSpeech } from '../utils/useVietnameseSpeech';

interface VoiceScamSimulatorProps {
  onSpeakText?: (text: string) => void;
}

export function VoiceScamSimulator({ onSpeakText }: VoiceScamSimulatorProps) {
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [responseInput, setResponseInput] = useState('');
  const [evaluation, setEvaluation] = useState<SimulatorEvaluation | null>(null);
  const [passedCount, setPassedCount] = useState(0);

  const { isListening, isTranscribing, interimTranscript, micError, toggleListening } =
    useVietnameseSpeech((chunk) => {
      setResponseInput((prev) => (prev ? `${prev} ${chunk}` : chunk));
    });

  const scenario = VOICE_SIMULATOR_SCENARIOS[scenarioIdx] ?? VOICE_SIMULATOR_SCENARIOS[0];

  const handlePlayCallerVoice = () => {
    if (onSpeakText) {
      onSpeakText(scenario.callerLine);
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(scenario.callerLine);
      utter.lang = 'vi-VN';
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    }
  };

  const handleEvaluate = () => {
    const result = evaluateSimulatorResponse(scenario, responseInput);
    if (!evaluation && result.scoreDelta > 0) {
      setPassedCount((c) => c + 1);
    }
    setEvaluation(result);
  };

  const handleNext = () => {
    setScenarioIdx((i) => (i + 1) % VOICE_SIMULATOR_SCENARIOS.length);
    setResponseInput('');
    setEvaluation(null);
  };

  return (
    <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PhoneCall className="h-5 w-5 text-blue-700" aria-hidden="true" />
          <h3 className="text-base font-bold text-[#0F294A]">
            Tập trận cuộc gọi giọng nói ({scenarioIdx + 1}/{VOICE_SIMULATOR_SCENARIOS.length})
          </h3>
        </div>
        <span className="rounded-md bg-blue-700 px-2.5 py-0.5 text-xs font-bold tabular-nums text-white">
          Phản xạ đúng: {passedCount} lần
        </span>
      </div>

      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
        <span className="inline-block rounded-md bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
          {scenario.callerBadge}
        </span>
        <p className="mt-1.5 text-base font-bold text-slate-900">{scenario.title}</p>
        <p className="mt-2 rounded-lg bg-slate-50 p-3 text-base italic leading-relaxed text-slate-800">
          &ldquo;{scenario.callerLine}&rdquo;
        </p>

        <button
          type="button"
          onClick={handlePlayCallerVoice}
          className="mt-3 inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 text-sm font-bold text-blue-900 hover:bg-blue-100"
        >
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          <span>Nghe giọng kẻ lừa đảo gọi tới</span>
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        <label htmlFor="sim-reply-input" className="block text-sm font-bold text-slate-800">
          Cụ sẽ trả lời người gọi này thế nào? (Bấm micro để nói hoặc gõ vào ô dưới)
        </label>
        <textarea
          id="sim-reply-input"
          rows={2}
          value={responseInput}
          onChange={(e) => setResponseInput(e.target.value)}
          placeholder='Ví dụ: Tôi không đọc OTP đâu, tôi cúp máy gọi cho con cháu đây!'
          className="w-full rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900"
        />

        {(isListening || interimTranscript) && (
          <p className="text-sm font-medium text-blue-800" role="status">
            Đang nghe: {interimTranscript || 'Cụ hãy nói câu trả lời...'}
          </p>
        )}
        {micError && (
          <p className="text-sm font-semibold text-red-700" role="alert">
            {micError}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void toggleListening()}
            disabled={isTranscribing}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold ${
              isListening
                ? 'border-red-600 bg-red-600 text-white'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {isListening ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4 text-blue-700" />}
            <span>{isListening ? 'Dừng nói' : 'Nói trả lời'}</span>
          </button>

          <button
            type="button"
            onClick={handleEvaluate}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-blue-700 px-4 text-sm font-bold text-white hover:bg-blue-800"
          >
            Chấm điểm phản xạ
          </button>
        </div>
      </div>

      {evaluation && (
        <div
          role="status"
          className={`mt-3 rounded-xl border-2 p-3.5 ${
            evaluation.outcome === 'safe'
              ? 'border-emerald-500 bg-emerald-50 text-emerald-950'
              : evaluation.outcome === 'unsafe'
                ? 'border-red-500 bg-red-50 text-red-950'
                : 'border-orange-400 bg-orange-50 text-orange-950'
          }`}
        >
          <div className="flex items-start gap-2">
            {evaluation.outcome === 'safe' ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
            ) : (
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" aria-hidden="true" />
            )}
            <div>
              <p className="text-base font-bold">{evaluation.title}</p>
              <p className="mt-1 text-sm leading-relaxed">{evaluation.feedback}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleNext}
            className="mt-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3.5 text-sm font-bold text-slate-900 shadow-xs hover:bg-slate-100"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Tình huống gọi điện khác</span>
          </button>
        </div>
      )}
    </div>
  );
}
