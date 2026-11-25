import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Building2,
  Check,
  Copy,
  Crop,
  FileAudio,
  FileSearch,
  FileText,
  Hand,
  ImagePlus,
  KeyRound,
  Loader2,
  Mail,
  MessageSquare,
  Mic,
  PhoneOff,
  QrCode,
  Radio,
  RotateCw,
  SearchCheck,
  Send,
  Share2,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  buildChatHandoffSummary,
  buildFamilyHandoffSummary,
  buildLiveCallHandoffSummary,
} from '../shared/familyHandoff';
import { classifyChatAlertLevel, detectLiveCallRisk, isShortenedOrApkUrl } from '../shared/scamRules';
import { parseVietQrPayload } from '../shared/vietqrParser';
import {
  analyzeImageDiagnostics,
  fileToDataUrl,
  generateSampleScreenshot,
  renderTransformedImage,
  scanQrMultiRegion,
  type CropRect,
  type ImageDiagnostics,
  type MultiRegionQrResult,
} from '../utils/imageProcessor';
import { describeMicFailure, useVietnameseSpeech } from '../utils/useVietnameseSpeech';
import { AnnotatedEvidenceOverlay } from './AnnotatedEvidenceOverlay';
import { DeepfakeShieldCard } from './DeepfakeShieldCard';
import type {
  AlertLevel,
  ChatMessage,
  FamilyChallengeConfig,
  ScanResult,
  TrustedContact,
} from '../types/safeai';

interface UnifiedSafeStudioProps {
  senderName?: string;
  trustedContacts: TrustedContact[];
  familyChallenge: FamilyChallengeConfig;
  sosNumbers: [string, string];
  latestScan: ScanResult | null;
  onScanComplete: (result: ScanResult) => void;
  onOpenEmergencyBrake: (scan: ScanResult) => void;
  onOpenRecoveryWizard?: (scan: ScanResult) => void;
  onOpenGuide?: (topic: 'qr' | 'voice') => void;
  onLookupEntity: (query: string) => void;
  onSpeakText: (text: string) => void;
  onStopSpeaking: () => void;
  isSpeaking: boolean;
  autoSpeak: boolean;
  onToggleAutoSpeak: (next: boolean) => void;
  onPrimeAudio: () => void;
  prefilledText?: string;
  sharedImageBlob?: Blob | null;
  onConsumeSharedImage?: () => void;
  messages: ChatMessage[];
  onAppendMessage: (msg: ChatMessage) => void;
}

const ALERT_STYLES = {
  red: {
    container: 'border-2 border-red-500 bg-red-50 text-red-950',
    headerBar: 'bg-red-600 text-white',
    badgeLabel: 'MỨC ĐỎ',
    title: 'CẢNH BÁO ĐỎ: NGUY HIỂM',
    Icon: ShieldAlert,
  },
  orange: {
    container: 'border-2 border-orange-500 bg-orange-50 text-orange-950',
    headerBar: 'bg-orange-500 text-white',
    badgeLabel: 'MỨC CAM',
    title: 'CẢNH BÁO CAM: ĐÁNG NGỜ',
    Icon: AlertTriangle,
  },
  green: {
    container: 'border-2 border-emerald-500 bg-emerald-50 text-emerald-950',
    headerBar: 'bg-emerald-600 text-white',
    badgeLabel: 'MỨC XANH',
    title: 'CẢNH BÁO XANH: AN TOÀN',
    Icon: ShieldCheck,
  },
} as const;

const CHAT_ALERT_STYLES: Record<
  AlertLevel,
  {
    bubble: string;
    header: string;
    badge: string;
    actionBtn: string;
    Icon: typeof ShieldAlert;
  }
> = {
  red: {
    bubble: 'border-2 border-red-500 bg-red-50 text-red-950',
    header: 'bg-red-600 text-white',
    badge: 'MỨC ĐỎ · NGUY HIỂM',
    actionBtn: 'text-red-800 hover:text-red-950',
    Icon: ShieldAlert,
  },
  orange: {
    bubble: 'border-2 border-orange-500 bg-orange-50 text-orange-950',
    header: 'bg-orange-500 text-white',
    badge: 'MỨC CAM · CẦN CẢNH GIÁC',
    actionBtn: 'text-orange-800 hover:text-orange-950',
    Icon: AlertTriangle,
  },
  green: {
    bubble: 'border-2 border-emerald-500 bg-emerald-50 text-emerald-950',
    header: 'bg-emerald-600 text-white',
    badge: 'MỨC XANH · AN TOÀN',
    actionBtn: 'text-emerald-800 hover:text-emerald-950',
    Icon: ShieldCheck,
  },
};

const STARTER_QUESTIONS = [
  'Có người gọi xưng công an bảo tôi ra tòa, tôi phải làm sao?',
  'Làm sao biết ảnh chuyển khoản ngân hàng là thật hay giả?',
  'Tôi lỡ bấm vào đường link lạ rồi thì cần làm gì ngay?',
];

function isConversationalQuestion(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const hasUrlOrPhone =
    /https?:\/\/|\.[a-z]{2,}\//i.test(lower) || /\b0\d{8,10}\b/.test(lower);
  if (hasUrlOrPhone) return false;
  return (
    lower.includes('?') ||
    /^(làm sao|phải làm sao|tôi nên|cho hỏi|vì sao|tại sao|có nên)/i.test(lower) ||
    /(là thật hay giả|làm gì ngay)/i.test(lower)
  );
}



function float32ToBase64Pcm16(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buf);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64Pcm16ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const view = new DataView(bytes.buffer);
  const out = new Float32Array(bytes.byteLength / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = view.getInt16(i * 2, true) / 32768;
  }
  return out;
}

export function UnifiedSafeStudio({
  senderName = 'Bố/Mẹ',
  trustedContacts,
  familyChallenge,
  sosNumbers,
  latestScan,
  onScanComplete,
  onOpenEmergencyBrake,
  onOpenRecoveryWizard,
  onOpenGuide,
  onLookupEntity,
  onSpeakText,
  onStopSpeaking,
  isSpeaking,
  autoSpeak,
  onToggleAutoSpeak,
  onPrimeAudio,
  prefilledText = '',
  sharedImageBlob = null,
  onConsumeSharedImage,
  messages,
  onAppendMessage,
}: UnifiedSafeStudioProps) {
  const [isDragging, setIsDragging] = useState(false);

  // Image studio state
  const [originalDataUrl, setOriginalDataUrl] = useState<string>('');
  const [previewDataUrl, setPreviewDataUrl] = useState<string>('');
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [centerCrop, setCenterCrop] = useState<boolean>(false);
  const [enhanceContrast, setEnhanceContrast] = useState<boolean>(false);
  const [diagnostics, setDiagnostics] = useState<ImageDiagnostics | null>(null);
  const [qrResult, setQrResult] = useState<MultiRegionQrResult | null>(null);
  const [sampleKind, setSampleKind] = useState<
    'fake_qr_bank' | 'fake_receipt' | 'safe_carrier' | 'fake_vietqr_police' | null
  >(null);

  // Selected bounding box & handoff state
  const [selectedEvidenceIdx, setSelectedEvidenceIdx] = useState<number | null>(null);
  const [copiedHandoff, setCopiedHandoff] = useState(false);

  // Unified text & Vietnamese voice input
  const [textInput, setTextInput] = useState(prefilledText);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [isFileTranscribing, setIsFileTranscribing] = useState(false);

  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    isListening,
    isTranscribing,
    interimTranscript,
    micError,
    toggleListening,
  } = useVietnameseSpeech((chunk) => {
    setTextInput((prev) => (prev ? `${prev} ${chunk}` : chunk));
  });

  // Live Call Risk Shield state
  const [liveStatus, setLiveStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [liveStatusText, setLiveStatusText] = useState('');
  const [liveTranscriptLog, setLiveTranscriptLog] = useState<{ who: 'user' | 'ai'; text: string }[]>([]);
  const [shieldActive, setShieldActive] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const inputCtxRef = useRef<AudioContext | null>(null);
  const outputCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const prevRiskLevelRef = useRef<string>('green');

  const combinedLiveText = useMemo(
    () => liveTranscriptLog.map((item) => item.text).join(' '),
    [liveTranscriptLog]
  );

  const liveCallRisk = useMemo(() => {
    if (!shieldActive || !combinedLiveText.trim()) return null;
    return detectLiveCallRisk(combinedLiveText);
  }, [shieldActive, combinedLiveText]);

  useEffect(() => {
    if (liveCallRisk?.level === 'red' && prevRiskLevelRef.current !== 'red') {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([200, 100, 200]);
      }
    }
    prevRiskLevelRef.current = liveCallRisk?.level ?? 'green';
  }, [liveCallRisk?.level]);

  useEffect(() => {
    if (messages.length > 1) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages.length, isBusy]);

  useEffect(() => {
    return () => {
      stopLiveConversation();
    };
  }, []);

  useEffect(() => {
    if (prefilledText) {
      setTextInput(prefilledText);
    }
  }, [prefilledText]);

  useEffect(() => {
    if (sharedImageBlob) {
      void loadNewImageBlob(sharedImageBlob);
      onConsumeSharedImage?.();
    }
  }, [sharedImageBlob]);

  useEffect(() => {
    setSelectedEvidenceIdx(null);
    setCopiedHandoff(false);
  }, [latestScan?.id]);

  // Global Ctrl+V clipboard image paste support
  useEffect(() => {
    function handlePaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            e.preventDefault();
            void loadNewImageBlob(blob);
            break;
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Re-render transformed preview & re-run multi-region QR whenever studio controls change
  useEffect(() => {
    if (!originalDataUrl) return;
    let cancelled = false;
    const crop: CropRect | null = centerCrop ? { x: 0.1, y: 0.15, w: 0.8, h: 0.7 } : null;

    void (async () => {
      try {
        const rendered = await renderTransformedImage(originalDataUrl, {
          rotation,
          crop,
          enhanceContrast,
        });
        if (cancelled) return;
        setPreviewDataUrl(rendered);
        const [diag, qr] = await Promise.all([
          analyzeImageDiagnostics(rendered),
          scanQrMultiRegion(rendered),
        ]);
        if (cancelled) return;
        setDiagnostics(diag);
        setQrResult(qr);
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Không xử lý được ảnh.');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [originalDataUrl, rotation, centerCrop, enhanceContrast]);

  async function loadNewImageBlob(blob: Blob) {
    setErrorMessage('');
    if (blob.size > 15 * 1024 * 1024) {
      setErrorMessage('Ảnh vượt quá 15 MB. Vui lòng chọn ảnh nhẹ hơn.');
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(blob);
      setSampleKind(null);
      setRotation(0);
      setCenterCrop(false);
      setEnhanceContrast(false);
      setOriginalDataUrl(dataUrl);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không đọc được tệp ảnh.');
    }
  }

  async function handleLoadSample(
    kind: 'fake_qr_bank' | 'fake_receipt' | 'safe_carrier' | 'fake_vietqr_police'
  ) {
    setErrorMessage('');
    const dataUrl = await generateSampleScreenshot(kind);
    if (!dataUrl) return;
    setSampleKind(kind);
    setRotation(0);
    setCenterCrop(false);
    setEnhanceContrast(false);
    setOriginalDataUrl(dataUrl);
  }

  function handleClearImage() {
    setOriginalDataUrl('');
    setPreviewDataUrl('');
    setDiagnostics(null);
    setQrResult(null);
    setSampleKind(null);
    setRotation(0);
    setCenterCrop(false);
    setEnhanceContrast(false);
  }

  function speakScanResult(completed: ScanResult) {
    if (!autoSpeak) return;
    const prefix =
      completed.alertLevel === 'red'
        ? 'Cảnh báo Đỏ, nguy hiểm.'
        : completed.alertLevel === 'orange'
          ? 'Cảnh báo Cam, đáng ngờ.'
          : 'Thông báo an toàn.';
    onSpeakText(`${prefix} ${completed.reply || completed.summary}`);
  }

  async function handleAnalyzeImage(overrideEnhance?: boolean) {
    if (!originalDataUrl || isBusy) return;
    setErrorMessage('');
    if (autoSpeak) onPrimeAudio();
    setIsBusy(true);

    const typedNote = textInput.trim();
    const userDisplayText = typedNote || 'Kiểm tra giúp tôi ảnh chụp / mã QR này';
    const currentPreview = previewDataUrl || originalDataUrl;

    onAppendMessage({
      id: `u-img-${Date.now()}`,
      role: 'user',
      text: userDisplayText,
      imagePreviewUrl: currentPreview,
      createdAt: new Date().toISOString(),
    });

    try {
      const useEnhance = overrideEnhance ?? enhanceContrast;
      if (overrideEnhance !== undefined && overrideEnhance !== enhanceContrast) {
        setEnhanceContrast(overrideEnhance);
      }
      const crop: CropRect | null = centerCrop ? { x: 0.1, y: 0.15, w: 0.8, h: 0.7 } : null;
      const finalImage = await renderTransformedImage(originalDataUrl, {
        rotation,
        crop,
        enhanceContrast: useEnhance,
      });

      const res = await fetch('/api/check-scam-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: finalImage,
          qrDecoded: qrResult?.found ? qrResult.value : '',
          qrRegion: qrResult?.regionLabel ?? '',
          qrBbox: qrResult?.found ? qrResult.qrBbox : undefined,
          userContext: typedNote,
          trustedContacts,
          sampleKind,
          imageWidth: diagnostics?.width,
          imageHeight: diagnostics?.height,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Chưa thể phân tích ảnh.');

      const completed: ScanResult = {
        ...data,
        id: `scan-${Date.now()}`,
        sourceMode: 'image',
        userContext: typedNote || data.userContext || undefined,
        createdAt: new Date().toISOString(),
        imagePreviewUrl: finalImage,
      };
      onScanComplete(completed);

      const replyMsgId = `m-scan-${Date.now()}`;
      onAppendMessage({
        id: replyMsgId,
        role: 'model',
        text: completed.reply || completed.summary,
        alertLevel: completed.alertLevel,
        createdAt: new Date().toISOString(),
      });
      setSpeakingMsgId(replyMsgId);
      speakScanResult(completed);

      if (!overrideEnhance) {
        handleClearImage();
        setTextInput('');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không thể phân tích ảnh.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleUnifiedTextSubmit(overrideText?: string, forceChat = false) {
    const clean = (overrideText ?? textInput).trim();
    if (!clean || isBusy) return;
    setErrorMessage('');
    if (autoSpeak) onPrimeAudio();

    onAppendMessage({
      id: `u-${Date.now()}`,
      role: 'user',
      text: clean,
      createdAt: new Date().toISOString(),
    });
    if (!overrideText) setTextInput('');
    setIsBusy(true);

    const runChat = forceChat || isConversationalQuestion(clean);

    try {
      if (runChat) {
        const scanContext = latestScan
          ? `Mức cảnh báo: ${latestScan.alertLevel.toUpperCase()} (${latestScan.scamType}). Tóm tắt: ${latestScan.summary}. Chữ trích xuất: ${latestScan.extractedText.slice(0, 600)}`
          : '';
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            history: messages.map((m) => ({ role: m.role, text: m.text })),
            message: clean,
            fastMode: false,
            scanContext,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không nhận được phản hồi từ trợ lý.');

        const modelMsgId = `m-${Date.now()}`;
        const replyText = String(data.reply || '');
        const resolvedLevel: AlertLevel =
          data.alertLevel === 'red' || data.alertLevel === 'orange' || data.alertLevel === 'green'
            ? data.alertLevel
            : classifyChatAlertLevel(clean, replyText, scanContext);

        onAppendMessage({
          id: modelMsgId,
          role: 'model',
          text: replyText,
          alertLevel: resolvedLevel,
          createdAt: new Date().toISOString(),
        });
        if (autoSpeak && replyText) {
          setSpeakingMsgId(modelMsgId);
          onSpeakText(replyText);
        }
      } else {
        const res = await fetch('/api/check-scam', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: clean,
            trustedContacts,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Chưa thể kiểm tra nội dung.');

        const completed: ScanResult = {
          ...data,
          id: `scan-${Date.now()}`,
          sourceMode: 'text',
          createdAt: new Date().toISOString(),
        };
        onScanComplete(completed);

        const modelMsgId = `m-${Date.now()}`;
        onAppendMessage({
          id: modelMsgId,
          role: 'model',
          text: completed.reply || completed.summary,
          alertLevel: completed.alertLevel,
          createdAt: new Date().toISOString(),
        });
        setSpeakingMsgId(modelMsgId);
        speakScanResult(completed);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi kết nối trợ lý.');
    } finally {
      setIsBusy(false);
    }
  }

  function handleUnifiedSubmit() {
    if (isBusy) return;
    if (originalDataUrl) {
      void handleAnalyzeImage();
    } else if (textInput.trim()) {
      void handleUnifiedTextSubmit();
    }
  }

  async function transcribeUploadedFile(blob: Blob, mimeType: string) {
    setIsFileTranscribing(true);
    setErrorMessage('');
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Không đọc được tệp âm thanh.'));
        reader.readAsDataURL(blob);
      });

      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64, mimeType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không chép lời được.');
      if (data.transcript) {
        setTextInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript));
        inputRef.current?.focus();
      } else {
        setErrorMessage('Chưa nghe rõ lời nói trong đoạn âm thanh.');
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi chép lời âm thanh.');
    } finally {
      setIsFileTranscribing(false);
    }
  }

  function handleAudioFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    void transcribeUploadedFile(file, file.type || 'audio/mp3');
  }

  function stopLiveConversation() {
    for (const src of activeSourcesRef.current) {
      try {
        src.stop();
      } catch {
        // ignore
      }
    }
    activeSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (inputCtxRef.current) {
      void inputCtxRef.current.close();
      inputCtxRef.current = null;
    }
    if (outputCtxRef.current) {
      void outputCtxRef.current.close();
      outputCtxRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setLiveStatus('idle');
    setLiveStatusText('');
  }

  function playLivePcmChunk(base64Pcm: string) {
    const ctx = outputCtxRef.current;
    if (!ctx) return;
    const samples = base64Pcm16ToFloat32(base64Pcm);
    const audioBuffer = ctx.createBuffer(1, samples.length, 24000);
    audioBuffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    const now = ctx.currentTime;
    const startAt = Math.max(now, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + audioBuffer.duration;
    activeSourcesRef.current.add(source);
    source.onended = () => {
      activeSourcesRef.current.delete(source);
    };
  }

  async function startLiveConversation() {
    if (liveStatus === 'connecting' || liveStatus === 'connected') {
      stopLiveConversation();
      return;
    }

    setLiveStatus('connecting');
    setLiveStatusText('Đang kết nối trợ lý thoại trực tiếp...');
    setLiveTranscriptLog([]);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Trình duyệt này chưa hỗ trợ truy cập micro.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputCtxRef.current = inputCtx;
      outputCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        setLiveStatusText('Đang khởi tạo phiên thoại SafeAI...');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.ready) {
            setLiveStatus('connected');
            setLiveStatusText(
              'Đã kết nối — Ông/Bà có thể nói trực tiếp hoặc bật loa ngoài để Lá chắn theo dõi.'
            );
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            processor.onaudioprocess = (ev) => {
              if (ws.readyState === WebSocket.OPEN) {
                const pcmBase64 = float32ToBase64Pcm16(ev.inputBuffer.getChannelData(0));
                ws.send(JSON.stringify({ audio: pcmBase64 }));
              }
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          } else if (msg.audio) {
            playLivePcmChunk(msg.audio);
          } else if (msg.interrupted) {
            for (const src of activeSourcesRef.current) {
              try {
                src.stop();
              } catch {
                // ignore
              }
            }
            activeSourcesRef.current.clear();
            nextStartTimeRef.current = 0;
          } else if (msg.inputTranscript) {
            setLiveTranscriptLog((prev) => [...prev.slice(-14), { who: 'user', text: msg.inputTranscript }]);
          } else if (msg.outputTranscript) {
            setLiveTranscriptLog((prev) => [...prev.slice(-14), { who: 'ai', text: msg.outputTranscript }]);
          } else if (msg.error) {
            setLiveStatus('error');
            setLiveStatusText(msg.error);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        setLiveStatus('error');
        setLiveStatusText('Không kết nối được phiên thoại trực tiếp.');
      };

      ws.onclose = () => {
        if (wsRef.current) {
          stopLiveConversation();
        }
      };
    } catch (err) {
      stopLiveConversation();
      setLiveStatus('error');
      setLiveStatusText(describeMicFailure(err));
    }
  }

  function handleSimulateScamCall() {
    setShieldActive(true);
    setLiveTranscriptLog([
      {
        who: 'user',
        text: 'Alo, anh nói anh ở bên Công an điều tra, bảo tôi có lệnh triệu tập và cần chuyển tiền vào tài khoản an toàn kèm đọc mã OTP để xác minh VNeID đúng không?',
      },
      {
        who: 'ai',
        text: 'DỪNG LẠI NGAY CỤ ƠI! Đây là kịch bản giả danh công an đòi mã OTP và chuyển tiền sang tài khoản an toàn. Công an không bao giờ làm việc qua điện thoại hay yêu cầu chuyển tiền!',
      },
    ]);
  }

  async function handleCopyHandoff(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHandoff(true);
      setTimeout(() => setCopiedHandoff(false), 3000);
    } catch {
      setErrorMessage(
        'Trình duyệt chưa cho phép sao chép tự động — Ông/Bà có thể chọn đoạn tóm tắt để sao chép.'
      );
    }
  }

  const activeAlertMeta = latestScan ? ALERT_STYLES[latestScan.alertLevel] : null;
  const AlertIcon = activeAlertMeta?.Icon ?? ShieldCheck;
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user') ?? null;
  const lastModelMsg =
    lastUserMsg
      ? [...messages].reverse().find((m) => m.role === 'model' && m.id !== 'welcome-1') ?? null
      : null;

  const handoffText = latestScan
    ? buildFamilyHandoffSummary(latestScan, senderName)
    : lastUserMsg && lastModelMsg
      ? buildChatHandoffSummary({
          userText: lastUserMsg.text,
          modelReply: lastModelMsg.text,
          alertLevel: lastModelMsg.alertLevel ?? 'orange',
          senderName,
          createdAt: lastModelMsg.createdAt,
        })
      : '';

  const liveCallHandoffText =
    liveCallRisk && liveTranscriptLog.length > 0
      ? buildLiveCallHandoffSummary({
          transcriptLines: liveTranscriptLog,
          riskHeadline: liveCallRisk.alertHeadline,
          triggers: liveCallRisk.matchedTriggers,
          level: liveCallRisk.level,
          senderName,
        })
      : '';

  const primarySos = sosNumbers.find((s) => s.trim().length > 0)?.trim() ?? '';

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      {/* Left Column: Unified Chat + Message + Mic + Image/QR Studio */}
      <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6 lg:col-span-7">
        <div className="border-b border-slate-100 pb-4">
          <h1 className="text-2xl font-bold tracking-tight text-[#0F294A]">
            Kiểm tra &amp; Hỏi Trợ lý An toàn
          </h1>
          <p className="mt-1 text-base text-slate-600">
            Gửi ảnh chụp, nói micro, dán tin nhắn hoặc hỏi đáp — tất cả ở ngay một chỗ.
          </p>
          {onOpenGuide && (
            <button
              type="button"
              onClick={() => onOpenGuide('qr')}
              className="mt-2 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold text-blue-700 underline-offset-4 hover:underline"
            >
              <QrCode className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Xem hướng dẫn quét QR &amp; nhận diện giọng nói</span>
            </button>
          )}
        </div>

        {/* Conversation & Quick Answer Thread */}
        <div className="mt-4 max-h-[360px] min-h-[160px] flex-1 space-y-3.5 overflow-y-auto pr-1">
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[88%] rounded-2xl bg-blue-700 px-4 py-3 text-base leading-relaxed text-white">
                    {msg.imagePreviewUrl && (
                      <img
                        src={msg.imagePreviewUrl}
                        alt="Ảnh đã gửi để kiểm tra"
                        className="mb-2 max-h-40 rounded-lg bg-white/10 object-contain"
                      />
                    )}
                    <p className="whitespace-pre-line">{msg.text}</p>
                  </div>
                </div>
              );
            }

            const level: AlertLevel = msg.alertLevel ?? classifyChatAlertLevel('', msg.text);
            const alertStyle = CHAT_ALERT_STYLES[level];
            const BubbleIcon = alertStyle.Icon;
            const isThisSpeaking = isSpeaking && (speakingMsgId === msg.id || speakingMsgId === null);

            return (
              <div key={msg.id} className="flex justify-start">
                <div
                  className={`max-w-[92%] overflow-hidden rounded-2xl text-base leading-relaxed shadow-xs ${alertStyle.bubble}`}
                >
                  <div className={`flex items-center gap-2 px-4 py-2 ${alertStyle.header}`}>
                    <BubbleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="text-xs font-extrabold tracking-wide">{alertStyle.badge}</span>
                  </div>
                  <div className="px-4 py-3">
                    <p className="whitespace-pre-line font-medium">{msg.text}</p>
                    <button
                      type="button"
                      onClick={() => {
                        if (isThisSpeaking) {
                          setSpeakingMsgId(null);
                          onStopSpeaking();
                        } else {
                          onPrimeAudio();
                          setSpeakingMsgId(msg.id);
                          onSpeakText(msg.text);
                        }
                      }}
                      className={`mt-2 inline-flex min-h-[36px] items-center gap-1.5 text-sm font-bold ${alertStyle.actionBtn}`}
                    >
                      {isThisSpeaking ? (
                        <>
                          <VolumeX className="h-4 w-4" aria-hidden="true" />
                          <span>Dừng đọc</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-4 w-4" aria-hidden="true" />
                          <span>Nghe đọc</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {isBusy && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-3 text-base font-medium text-slate-700">
              <Loader2 className="h-4 w-4 animate-spin text-blue-700" aria-hidden="true" />
              <span>Cháu đang kiểm tra &amp; trả lời cho Ông/Bà...</span>
            </div>
          )}
          <div ref={threadEndRef} />
        </div>

        {/* Starter Quick Questions */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {STARTER_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => void handleUnifiedTextSubmit(q, true)}
              className="min-h-[42px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-100"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Unified Composer Box: Text + Mic + Image + QR + Submit */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) void loadNewImageBlob(dropped);
          }}
          className={`mt-4 space-y-3 rounded-2xl border-2 p-4 transition-colors ${
            isDragging
              ? 'border-blue-600 bg-blue-50/70'
              : 'border-slate-200 bg-slate-50/60'
          }`}
        >
          {previewDataUrl && (
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800">Ảnh đã đính kèm</span>
                <button
                  type="button"
                  onClick={handleClearImage}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span>Bỏ ảnh</span>
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100/80 p-2">
                <img
                  src={previewDataUrl}
                  alt="Ảnh xem trước chuẩn bị kiểm tra lừa đảo"
                  className="mx-auto max-h-56 w-auto rounded-lg object-contain"
                />
              </div>

              {qrResult?.found && (() => {
                const previewVietQr = parseVietQrPayload(qrResult.value);
                return (
                  <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-sm text-blue-950">
                    <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">
                        {previewVietQr
                          ? `Đã đọc mã chuyển tiền: ${previewVietQr.bankShortName} · STK ${previewVietQr.accountNumber}${previewVietQr.amountFormatted ? ` · ${previewVietQr.amountFormatted}` : ''}`
                          : `Đã đọc mã QR trong ảnh (${qrResult.regionLabel})`}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <details className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5">
                <summary className="cursor-pointer text-sm font-semibold text-slate-700">
                  Chỉnh sửa ảnh (xoay, cắt, làm rõ chữ)
                </summary>
                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                  {diagnostics && (
                    <p className="text-xs text-slate-600 tabular-nums">
                      Kích thước: {diagnostics.width}×{diagnostics.height}px · {diagnostics.qualityLabel}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <RotateCw className="h-4 w-4" aria-hidden="true" />
                      <span>Xoay 90°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCenterCrop((v) => !v)}
                      className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${
                        centerCrop
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <Crop className="h-4 w-4" aria-hidden="true" />
                      <span>{centerCrop ? 'Đang cắt giữa' : 'Cắt vùng giữa'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEnhanceContrast((v) => !v)}
                      className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${
                        enhanceContrast
                          ? 'border-blue-600 bg-blue-50 text-blue-800'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                      <span>{enhanceContrast ? 'Đã làm rõ chữ' : 'Làm rõ chữ'}</span>
                    </button>
                  </div>
                  {qrResult?.found && (
                    <p className="font-mono text-xs break-all text-slate-600">
                      Dữ liệu QR thô: {qrResult.value}
                    </p>
                  )}
                </div>
              </details>
            </div>
          )}

          <div>
            <label htmlFor="scam-text-input" className="sr-only">
              Nhập tin nhắn, câu hỏi hoặc nội dung cuộc gọi cần kiểm tra
            </label>
            <textarea
              ref={inputRef}
              id="scam-text-input"
              rows={previewDataUrl ? 2 : 3}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleUnifiedSubmit();
                }
              }}
              placeholder={
                previewDataUrl
                  ? 'Ghi thêm lời người gửi nhắn (không bắt buộc)...'
                  : 'Dán tin nhắn, gõ câu hỏi, bấm nói micro hoặc chọn ảnh bên dưới...'
              }
              className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-base leading-relaxed text-slate-900 sm:text-lg"
            />
          </div>

          {(isListening || interimTranscript) && (
            <div className="rounded-xl bg-blue-50 px-4 py-2.5 text-sm text-blue-950" role="status">
              <p className="font-semibold">
                Đang nghe Ông/Bà nói... (bấm &quot;Dừng micro&quot; khi nói xong)
              </p>
              {interimTranscript && <p className="mt-1 italic text-blue-800">{interimTranscript}</p>}
            </div>
          )}

          {(micError || errorMessage) && (
            <p className="rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-800" role="alert">
              {micError || errorMessage}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <label className="inline-flex min-h-[48px] cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-800 transition-colors hover:border-blue-400 hover:bg-blue-50/50">
              <ImagePlus className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
              <span>{previewDataUrl ? 'Đổi ảnh' : 'Chọn ảnh'}</span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void loadNewImageBlob(f);
                }}
              />
            </label>

            <button
              type="button"
              onClick={() => void toggleListening()}
              disabled={isTranscribing}
              className={`inline-flex min-h-[48px] items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-base font-bold transition-colors ${
                isListening
                  ? 'border-red-600 bg-red-600 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
            >
              {isListening ? (
                <Square className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <Mic className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
              )}
              <span>
                {isListening
                  ? 'Dừng micro'
                  : isTranscribing
                    ? 'Đang ghi chữ...'
                    : 'Nói micro'}
              </span>
            </button>
          </div>

          <button
            type="button"
            disabled={isBusy || (!originalDataUrl && !textInput.trim())}
            onClick={handleUnifiedSubmit}
            className="inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-700 px-6 text-lg font-bold text-white shadow-xs transition-colors hover:bg-blue-800 disabled:opacity-50"
          >
            {isBusy ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                <span>Đang kiểm tra cho Ông/Bà...</span>
              </>
            ) : (
              <>
                <Send className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{originalDataUrl ? 'Kiểm tra ảnh ngay' : 'Kiểm tra & Gửi'}</span>
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-500">
            Mẹo: Có thể kéo thả ảnh vào khung này hoặc bấm Ctrl+V để dán ảnh chụp màn hình.
          </p>
        </div>

        {/* Sample Images */}
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-sm font-bold text-slate-700">Hoặc bấm thử ảnh mẫu có sẵn:</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleLoadSample('fake_qr_bank')}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              Mẫu 1: Cảnh báo ngân hàng + QR giả
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('fake_vietqr_police')}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              Mẫu 2: Lệnh Công an + VietQR giả
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('fake_receipt')}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              Mẫu 3: Biên lai yêu cầu nạp phí
            </button>
            <button
              type="button"
              onClick={() => handleLoadSample('safe_carrier')}
              className="min-h-[44px] rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              Mẫu 4: Tin khuyến mãi VinaPhone
            </button>
          </div>
        </div>
      </section>

      {/* Right Column: Detailed Verdict + Call Shield + Collapsed Extra Tools */}
      <div className="space-y-5 lg:col-span-5">
        {/* 1. Detailed Check Result Card */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <h2 className="text-xl font-bold text-[#0F294A]">Kết quả kiểm tra</h2>

          {isBusy ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-8 text-center">
              <Loader2 className="h-9 w-9 animate-spin text-blue-700" aria-hidden="true" />
              <p className="mt-3 text-base font-semibold text-slate-900">
                Cháu đang phân tích dấu hiệu giả mạo...
              </p>
            </div>
          ) : !latestScan || !activeAlertMeta ? (
            <div className="mt-4 space-y-3 rounded-2xl bg-slate-50/80 p-4">
              <p className="text-base font-bold text-slate-900">SafeAI báo rõ bằng 3 màu dễ nhìn:</p>
              <div className="space-y-2 text-sm sm:text-base">
                <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-red-950">
                  <ShieldAlert className="h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                  <span>
                    <strong className="font-bold">Đỏ · Nguy hiểm:</strong> Dừng ngay, không chuyển tiền hay đọc OTP.
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2.5 text-orange-950">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600" aria-hidden="true" />
                  <span>
                    <strong className="font-bold">Cam · Đáng ngờ:</strong> Chưa vội tin, nên gọi hỏi lại con cháu.
                  </span>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-emerald-950">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>
                    <strong className="font-bold">Xanh · An toàn:</strong> Chưa thấy dấu hiệu giả mạo.
                  </span>
                </div>
              </div>
              {handoffText && (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/75 p-3.5 text-left">
                  <div className="flex items-center gap-2 text-[#0F294A]">
                    <Share2 className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    <h3 className="text-sm font-bold">Gửi nội dung vừa hỏi nhờ con cháu xem giúp</h3>
                  </div>
                  <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl border border-blue-200 bg-white p-3 font-sans text-xs leading-relaxed text-slate-800">
                    {handoffText}
                  </pre>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopyHandoff(handoffText)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 text-sm font-bold text-white hover:bg-blue-800"
                    >
                      {copiedHandoff ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      <span>{copiedHandoff ? 'Đã sao chép!' : 'Sao chép gửi Zalo'}</span>
                    </button>
                    <a
                      href={`sms:${primarySos}?body=${encodeURIComponent(handoffText)}`}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-900 hover:bg-slate-50"
                    >
                      <MessageSquare className="h-4 w-4 text-blue-700" aria-hidden="true" />
                      <span>{primarySos ? `Nhắn SMS (${primarySos})` : 'Nhắn tin SMS'}</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className={`overflow-hidden rounded-2xl shadow-xs ${activeAlertMeta.container}`}>
                <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${activeAlertMeta.headerBar}`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AlertIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-base font-extrabold tracking-tight">{activeAlertMeta.title}</p>
                      <p className="text-xs font-medium text-white/90">{latestScan.scamType}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-white/40 bg-black/15 px-2 py-0.5 text-xs font-extrabold tracking-wider">
                    {activeAlertMeta.badgeLabel}
                  </span>
                </div>

                <div className="p-4">
                  <div
                    className="mb-3 grid grid-cols-3 gap-1 rounded-lg bg-white/85 p-1 text-center text-xs font-bold"
                    aria-label="Thang mức độ cảnh báo Đỏ, Cam, Xanh"
                  >
                    <div
                      className={`rounded-md px-1 py-1 ${
                        latestScan.alertLevel === 'red'
                          ? 'bg-red-600 text-white shadow-xs'
                          : 'text-red-700/65'
                      }`}
                    >
                      Đỏ
                    </div>
                    <div
                      className={`rounded-md px-1 py-1 ${
                        latestScan.alertLevel === 'orange'
                          ? 'bg-orange-500 text-white shadow-xs'
                          : 'text-orange-700/65'
                      }`}
                    >
                      Cam
                    </div>
                    <div
                      className={`rounded-md px-1 py-1 ${
                        latestScan.alertLevel === 'green'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-emerald-700/65'
                      }`}
                    >
                      Xanh
                    </div>
                  </div>

                  <p className="text-base font-semibold leading-relaxed">{latestScan.summary}</p>

                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (isSpeaking) {
                          onStopSpeaking();
                        } else {
                          onPrimeAudio();
                          onSpeakText(latestScan.reply || latestScan.summary);
                        }
                      }}
                      className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-4 text-sm font-bold transition-colors ${
                        isSpeaking
                          ? 'border-blue-700 bg-blue-700 text-white'
                          : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      {isSpeaking ? (
                        <>
                          <VolumeX className="h-4 w-4" aria-hidden="true" />
                          <span>Dừng đọc</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-4 w-4 text-blue-700" aria-hidden="true" />
                          <span>Nghe đọc lời khuyên</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {latestScan.impersonationWarning && (
                <div className="rounded-xl border-2 border-red-400 bg-red-50 p-3.5 text-sm font-semibold text-red-900">
                  {latestScan.impersonationWarning}
                </div>
              )}

              {latestScan.familyChallengeTriggered && (
                <div className="rounded-xl border-2 border-orange-400 bg-orange-50 p-3.5 text-orange-950">
                  <div className="flex items-start gap-2">
                    <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-orange-700" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-bold">
                        Coi chừng giả danh người thân — Hãy hỏi câu bí mật gia đình!
                      </p>
                      <p className="mt-1 text-sm">
                        {familyChallenge.question.trim()
                          ? `Hỏi lại ngay người nhắn: "${familyChallenge.question}"`
                          : 'Hãy gọi lại vào số điện thoại cũ của con cháu và hỏi một kỷ niệm riêng của gia đình.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {latestScan.actionSteps.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-sm font-bold text-[#0F294A]">Ông/Bà cần làm gì ngay?</h3>
                  <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm font-medium text-slate-900">
                    {latestScan.actionSteps.map((step, idx) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {latestScan.alertLevel !== 'green' && (
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenEmergencyBrake(latestScan)}
                    className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-base font-bold text-white hover:bg-red-700"
                  >
                    <Hand className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>Dừng lại, xử lý từng bước</span>
                  </button>
                  {onOpenRecoveryWizard && (
                    <button
                      type="button"
                      onClick={() => onOpenRecoveryWizard(latestScan)}
                      className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border-2 border-red-600 bg-white px-4 py-2 text-base font-bold text-red-700 hover:bg-red-50"
                    >
                      <AlertOctagon className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>Tôi lỡ chuyển tiền / bấm link rồi</span>
                    </button>
                  )}
                </div>
              )}

              <div className="rounded-xl border border-blue-200 bg-blue-50/75 p-3.5">
                <div className="flex items-center justify-between gap-2 text-[#0F294A]">
                  <div className="flex items-center gap-2">
                    <Share2 className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                    <h3 className="text-sm font-bold">Gửi nhờ con cháu xem giúp (đầy đủ chi tiết vụ việc)</h3>
                  </div>
                </div>
                <pre
                  aria-label="Nội dung tin nhắn SafeAI soạn sẵn gửi con cháu"
                  className="mt-2.5 max-h-44 overflow-y-auto whitespace-pre-wrap rounded-xl border border-blue-200 bg-white p-3 font-sans text-xs leading-relaxed text-slate-800"
                >
                  {handoffText}
                </pre>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleCopyHandoff(handoffText)}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 text-sm font-bold text-white hover:bg-blue-800"
                  >
                    {copiedHandoff ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    <span>{copiedHandoff ? 'Đã sao chép!' : 'Sao chép gửi Zalo'}</span>
                  </button>
                  <a
                    href={`sms:${primarySos}?body=${encodeURIComponent(handoffText)}`}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-bold text-slate-900 hover:bg-slate-50"
                  >
                    <MessageSquare className="h-4 w-4 text-blue-700" aria-hidden="true" />
                    <span>{primarySos ? `Nhắn SMS (${primarySos})` : 'Nhắn tin SMS'}</span>
                  </a>
                </div>
              </div>

              {latestScan.imageQuality && !latestScan.imageQuality.isClear && originalDataUrl && (
                <div className="rounded-xl border border-orange-300 bg-orange-50 p-3.5">
                  <p className="text-sm font-semibold text-orange-950">
                    Ảnh hơi mờ: {latestScan.imageQuality.note}
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleAnalyzeImage(true)}
                    className="mt-2 min-h-[44px] rounded-xl border border-orange-500 bg-white px-3.5 text-sm font-semibold text-orange-950 hover:bg-orange-100"
                  >
                    Tự động làm rõ chữ &amp; quét lại
                  </button>
                </div>
              )}

              <details className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
                <summary className="cursor-pointer text-sm font-bold text-[#0F294A]">
                  Xem chi tiết phân tích kỹ thuật (cho con cháu kiểm tra thêm)
                </summary>

                <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                  {latestScan.imagePreviewUrl &&
                    latestScan.visualEvidence.some((ev) => Boolean(ev.bbox)) && (
                      <AnnotatedEvidenceOverlay
                        imageUrl={latestScan.imagePreviewUrl}
                        evidence={latestScan.visualEvidence}
                        selectedIndex={selectedEvidenceIdx}
                        onSelectIndex={setSelectedEvidenceIdx}
                      />
                    )}

                  {latestScan.vietQr && (
                    <div className="rounded-xl border border-blue-300 bg-blue-50/75 p-3.5 text-slate-950">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
                          <h3 className="text-sm font-bold text-[#0F294A]">
                            Thông tin tài khoản trong mã VietQR
                          </h3>
                        </div>
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                            latestScan.vietQr.crcValid
                              ? 'bg-emerald-600 text-white'
                              : 'bg-orange-500 text-white'
                          }`}
                        >
                          {latestScan.vietQr.crcValid ? 'Mã CRC-16 hợp lệ' : 'CRC-16 không khớp'}
                        </span>
                      </div>
                      <dl className="mt-2.5 grid gap-2 text-sm sm:grid-cols-2">
                        <div className="rounded-lg bg-white px-3 py-2">
                          <dt className="text-xs font-semibold text-slate-500">Ngân hàng nhận</dt>
                          <dd className="font-bold text-slate-900">
                            {latestScan.vietQr.bankShortName} (BIN {latestScan.vietQr.bankBin || '—'})
                          </dd>
                        </div>
                        <div className="rounded-lg bg-white px-3 py-2">
                          <dt className="text-xs font-semibold text-slate-500">Số tài khoản nhận</dt>
                          <dd className="font-mono font-bold tabular-nums text-slate-900">
                            {latestScan.vietQr.accountNumber || 'Chưa rõ'}
                          </dd>
                        </div>
                        {latestScan.vietQr.amountFormatted && (
                          <div className="rounded-lg bg-white px-3 py-2">
                            <dt className="text-xs font-semibold text-slate-500">Số tiền cài sẵn</dt>
                            <dd className="font-bold tabular-nums text-red-700">
                              {latestScan.vietQr.amountFormatted}
                            </dd>
                          </div>
                        )}
                        {latestScan.vietQr.purpose && (
                          <div className="rounded-lg bg-white px-3 py-2">
                            <dt className="text-xs font-semibold text-slate-500">Nội dung chuyển khoản</dt>
                            <dd className="font-medium text-slate-900">{latestScan.vietQr.purpose}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {latestScan.receiptForensics?.isReceiptLike && (
                    <div
                      className={`rounded-xl border p-3.5 ${
                        latestScan.receiptForensics.anomalies.length > 0
                          ? 'border-red-300 bg-red-50 text-red-950'
                          : 'border-emerald-300 bg-emerald-50 text-emerald-950'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <FileSearch className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <h3 className="text-sm font-bold">
                          Kiểm tra biên lai ngân hàng
                          {latestScan.receiptForensics.detectedBank
                            ? ` (${latestScan.receiptForensics.detectedBank})`
                            : ''}
                        </h3>
                      </div>
                      {latestScan.receiptForensics.anomalies.length > 0 ? (
                        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                          {latestScan.receiptForensics.anomalies.map((anom, i) => (
                            <li key={i}>{anom}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-sm">
                          Chưa thấy mâu thuẫn rõ rệt về chữ viết, nhưng vẫn cần kiểm tra biến động số dư trong ứng dụng ngân hàng.
                        </p>
                      )}
                    </div>
                  )}

                  {latestScan.visualEvidence.length > 0 && (
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Các dấu hiệu chi tiết đã phát hiện</h3>
                      <div className="mt-2 space-y-2">
                        {latestScan.visualEvidence.map((ev, idx) => {
                          const isSelected = selectedEvidenceIdx === idx;
                          const severityStyle =
                            ev.severity === 'high'
                              ? {
                                  border: 'border-red-300 bg-red-50/70',
                                  tag: 'bg-red-600 text-white',
                                  marker: 'bg-red-600 text-white',
                                  label: 'Rủi ro cao · Đỏ',
                                }
                              : ev.severity === 'medium'
                                ? {
                                    border: 'border-orange-300 bg-orange-50/70',
                                    tag: 'bg-orange-500 text-white',
                                    marker: 'bg-orange-500 text-white',
                                    label: 'Cần lưu ý · Cam',
                                  }
                                : {
                                    border: 'border-emerald-300 bg-emerald-50/70',
                                    tag: 'bg-emerald-600 text-white',
                                    marker: 'bg-emerald-600 text-white',
                                    label: 'Thông tin · Xanh',
                                  };
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                ev.bbox ? setSelectedEvidenceIdx(isSelected ? null : idx) : undefined
                              }
                              className={`block w-full rounded-xl border px-3 py-2.5 text-left transition-colors ${
                                severityStyle.border
                              } ${isSelected ? 'ring-2 ring-blue-600' : 'hover:brightness-98'}`}
                            >
                              <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-900">
                                {ev.bbox && (
                                  <span
                                    className={`inline-flex h-5 min-w-[22px] items-center justify-center rounded px-1.5 text-xs font-bold tabular-nums ${severityStyle.marker}`}
                                  >
                                    {idx + 1}
                                  </span>
                                )}
                                <span>{ev.category}</span>
                                <span
                                  className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${severityStyle.tag}`}
                                >
                                  {severityStyle.label}
                                </span>
                              </div>
                              <p className="mt-1 text-sm text-slate-800">{ev.finding}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(latestScan.extractedEntities.urls.length > 0 ||
                    latestScan.extractedEntities.phones.length > 0 ||
                    latestScan.extractedEntities.bankAccounts.length > 0 ||
                    latestScan.extractedEntities.qrPayload) && (
                    <div className="space-y-2 text-sm">
                      <h3 className="text-sm font-bold text-slate-900">Link &amp; số điện thoại trích xuất</h3>
                      {latestScan.extractedEntities.qrPayload && (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2">
                          <span className="font-mono text-xs break-all text-slate-800">
                            QR: {latestScan.extractedEntities.qrPayload}
                          </span>
                          <button
                            type="button"
                            onClick={() => onLookupEntity(latestScan.extractedEntities.qrPayload)}
                            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            <SearchCheck className="h-4 w-4" />
                            <span>Tra cứu QR</span>
                          </button>
                        </div>
                      )}

                      {latestScan.extractedEntities.urls.map((url) => {
                        const flags = isShortenedOrApkUrl(url);
                        return (
                          <div
                            key={url}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                          >
                            <span className="font-mono text-xs break-all text-slate-800">
                              Link: {url}
                              {flags.isApkOrBinary && (
                                <span className="ml-1.5 font-sans font-bold text-red-700">
                                  (Cảnh báo tệp .APK)
                                </span>
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={() => onLookupEntity(url)}
                              className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                            >
                              <SearchCheck className="h-4 w-4" />
                              <span>Tra cứu link</span>
                            </button>
                          </div>
                        );
                      })}

                      {latestScan.extractedEntities.phones.map((phone) => (
                        <div
                          key={phone}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2"
                        >
                          <span className="font-mono text-xs tabular-nums text-slate-800">SĐT: {phone}</span>
                          <button
                            type="button"
                            onClick={() => onLookupEntity(phone)}
                            className="inline-flex min-h-[36px] shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                          >
                            <SearchCheck className="h-4 w-4" />
                            <span>Tra cứu số</span>
                          </button>
                        </div>
                      ))}

                      {latestScan.extractedEntities.bankAccounts.length > 0 && (
                        <p className="px-1 text-slate-800">
                          Số tài khoản phát hiện:{' '}
                          <span className="font-mono font-semibold tabular-nums">
                            {latestScan.extractedEntities.bankAccounts.join(', ')}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoSpeak}
                      onClick={() => onToggleAutoSpeak(!autoSpeak)}
                      className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                        autoSpeak
                          ? 'border-blue-200 bg-blue-50 text-blue-900'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>Tự động đọc kết quả: {autoSpeak ? 'Đang bật' : 'Đang tắt'}</span>
                    </button>
                    <a
                      href={`mailto:?subject=${encodeURIComponent(`[SafeAI] Nhờ kiểm tra: ${latestScan.scamType}`)}&body=${encodeURIComponent(handoffText)}`}
                      className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                    >
                      <Mail className="h-4 w-4 text-blue-700" aria-hidden="true" />
                      <span>Gửi qua Email</span>
                    </a>
                  </div>

                  {latestScan.extractedText && (
                    <div>
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <FileText className="h-4 w-4" aria-hidden="true" />
                        <span>Toàn bộ chữ trích xuất</span>
                      </p>
                      <pre className="mt-1.5 whitespace-pre-wrap rounded-xl bg-white p-3 font-mono text-xs leading-relaxed text-slate-700">
                        {latestScan.extractedText}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}
        </section>

        {/* 2. Live Call Risk Shield */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs sm:p-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Radio className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h2 className="text-lg font-bold text-[#0F294A]">Lá chắn cuộc gọi lạ</h2>
            </div>
            <button
              type="button"
              onClick={() => setShieldActive((v) => !v)}
              className={`min-h-[40px] rounded-lg border px-3 text-xs font-semibold ${
                shieldActive
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-300 bg-white text-slate-600'
              }`}
            >
              {shieldActive ? 'Đang bật' : 'Đang tắt'}
            </button>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base">
            Khi có cuộc gọi lạ, bật loa ngoài rồi bấm nút dưới đây để SafeAI nghe giúp và cảnh báo ngay nếu đòi OTP hay giả danh công an.
          </p>
          {onOpenGuide && (
            <button
              type="button"
              onClick={() => onOpenGuide('voice')}
              className="mt-1.5 inline-flex min-h-[40px] items-center gap-1.5 text-sm font-bold text-blue-700 underline-offset-4 hover:underline"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              <span>Xem hướng dẫn cách nhận diện giọng nói</span>
            </button>
          )}

          <div className="mt-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={startLiveConversation}
              className={`inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold text-white transition-colors ${
                liveStatus === 'connected' || liveStatus === 'connecting'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              {liveStatus === 'connected' || liveStatus === 'connecting' ? (
                <>
                  <PhoneOff className="h-5 w-5" aria-hidden="true" />
                  <span>Kết thúc nghe bảo vệ</span>
                </>
              ) : (
                <>
                  <Mic className="h-5 w-5" aria-hidden="true" />
                  <span>Bắt đầu nghe &amp; bảo vệ cuộc gọi</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleSimulateScamCall}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 hover:bg-slate-100"
            >
              <ShieldAlert className="h-4 w-4 text-red-600" aria-hidden="true" />
              <span>Nghe thử kịch bản giả danh</span>
            </button>
          </div>

          {liveStatusText && (
            <p
              className={`mt-3 text-sm font-medium ${
                liveStatus === 'error' ? 'text-red-700' : 'text-slate-700'
              }`}
              role="status"
            >
              {liveStatusText}
            </p>
          )}

          {liveCallRisk && (
            <div
              role="alert"
              className={`mt-4 rounded-xl border-2 p-4 ${
                liveCallRisk.level === 'red'
                  ? 'border-red-700 bg-red-600 text-white'
                  : liveCallRisk.level === 'orange'
                    ? 'border-orange-600 bg-orange-500 text-white'
                    : 'border-emerald-700 bg-emerald-600 text-white'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {liveCallRisk.level === 'green' ? (
                  <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                ) : (
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{liveCallRisk.alertHeadline}</p>
                  {liveCallRisk.matchedTriggers.length > 0 && (
                    <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-xs font-medium">
                      {liveCallRisk.matchedTriggers.map((trig) => (
                        <li key={trig}>{trig}</li>
                      ))}
                    </ul>
                  )}
                  {liveCallRisk.level !== 'green' && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onSpeakText(
                            `${liveCallRisk.alertHeadline}. Cúp máy ngay lập tức, không đọc OTP và không chuyển tiền.`
                          )
                        }
                        className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        <Volume2 className="h-4 w-4" aria-hidden="true" />
                        <span>Phát loa cảnh báo cúp máy ngay</span>
                      </button>
                      {liveCallHandoffText && (
                        <a
                          href={`sms:${primarySos}?body=${encodeURIComponent(liveCallHandoffText)}`}
                          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/60 bg-red-800/60 px-3 text-xs font-bold text-white hover:bg-red-900"
                        >
                          <MessageSquare className="h-4 w-4" aria-hidden="true" />
                          <span>Gửi nội dung cuộc gọi cho con cháu</span>
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {liveTranscriptLog.length > 0 && (
            <div className="mt-4 max-h-44 space-y-2 overflow-y-auto rounded-xl bg-slate-50 p-3 text-sm">
              {liveTranscriptLog.map((item, idx) => (
                <p key={idx} className="text-slate-800">
                  <strong className={item.who === 'user' ? 'text-blue-700' : 'text-emerald-700'}>
                    {item.who === 'user' ? 'Ông/Bà: ' : 'SafeAI: '}
                  </strong>
                  {item.text}
                </p>
              ))}
            </div>
          )}
        </section>

        {/* 3. Collapsed Audio Recording & Video Deepfake Tools */}
        <details className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <summary className="flex min-h-[52px] cursor-pointer items-center justify-between gap-2 px-5 py-3 text-base font-bold text-[#0F294A]">
            <span className="inline-flex items-center gap-2.5">
              <FileAudio className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
              <span>Gửi đoạn ghi âm cuộc gọi có sẵn (.mp3, .wav)</span>
            </span>
          </summary>
          <div className="border-t border-slate-100 p-5">
            <p className="text-sm text-slate-600">
              Tải tệp ghi âm cuộc gọi nghi ngờ để tự động chép thành chữ đưa vào khung kiểm tra bên trái.
            </p>
            <label className="mt-3 inline-flex min-h-[46px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 text-base font-semibold text-slate-800 hover:bg-slate-100">
              <FileAudio className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
              <span>Chọn tệp ghi âm (.mp3, .wav, .webm)</span>
              <input
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={handleAudioFileUpload}
              />
            </label>
            {isFileTranscribing && (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Đang chuyển giọng nói thành văn bản...</span>
              </p>
            )}
          </div>
        </details>

        <details className="rounded-2xl border border-slate-200 bg-white shadow-xs">
          <summary className="flex min-h-[52px] cursor-pointer items-center justify-between gap-2 px-5 py-3 text-base font-bold text-[#0F294A]">
            <span>Kiểm tra cuộc gọi video nghi giả mặt (Deepfake)</span>
          </summary>
          <div className="border-t border-slate-100 p-2">
            <DeepfakeShieldCard />
          </div>
        </details>
      </div>
    </div>
  );
}
