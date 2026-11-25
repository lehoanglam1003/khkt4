import { useCallback, useEffect, useRef, useState } from 'react';
import { fileToDataUrl } from './imageProcessor';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstanceLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

export function describeMicFailure(err: unknown): string {
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Trình duyệt chỉ cho phép bật micro trên kết nối bảo mật HTTPS.';
  }
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Micro đang bị chặn quyền truy cập. Cụ hãy bấm biểu tượng ổ khóa trên thanh địa chỉ trình duyệt và chọn "Cho phép Micro", hoặc mở trang ở tab trình duyệt riêng.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Không tìm thấy micro trên thiết bị này. Cụ có thể gắn tai nghe có mic hoặc gõ chữ trực tiếp.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Micro đang được ứng dụng khác sử dụng. Cụ hãy đóng bớt cuộc gọi hoặc tab khác rồi thử lại.';
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return 'Chưa bật được micro lúc này. Cụ hãy kiểm tra quyền micro của trình duyệt.';
}

export function useVietnameseSpeech(onFinalTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [micError, setMicError] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onTranscriptRef = useRef(onFinalTranscript);

  useEffect(() => {
    onTranscriptRef.current = onFinalTranscript;
  }, [onFinalTranscript]);

  const stopAll = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsListening(false);
    setInterimTranscript('');
  }, []);

  useEffect(() => stopAll, [stopAll]);

  const startMediaRecorderFallback = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('Trình duyệt trên thiết bị này chưa hỗ trợ ghi âm micro.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setIsListening(false);
        const mime = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size === 0) return;

        setIsTranscribing(true);
        try {
          const base64 = await fileToDataUrl(blob);
          const res = await fetch('/api/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ audio: base64, mimeType: mime }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(
              data.error || 'Chưa chép lời được. Cụ hãy dùng Chrome/Edge để nhận giọng nói trực tiếp.'
            );
          }
          if (data.transcript) {
            onTranscriptRef.current(String(data.transcript).trim());
          } else {
            setMicError('Chưa nghe rõ lời nói. Cụ hãy nói gần micro hơn một chút nhé.');
          }
        } catch (err) {
          setMicError(err instanceof Error ? err.message : 'Lỗi chép lời từ ghi âm.');
        } finally {
          setIsTranscribing(false);
        }
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsListening(true);
    } catch (err) {
      setMicError(describeMicFailure(err));
      setIsListening(false);
    }
  }, []);

  const toggleListening = useCallback(async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
        setIsListening(false);
        setInterimTranscript('');
        return;
      }
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.stop();
        return;
      }
      stopAll();
      return;
    }

    setMicError('');
    setInterimTranscript('');

    // First verify mic permission/hardware via SpeechRecognition if available
    const RecognitionCtor = getSpeechRecognitionCtor();
    if (RecognitionCtor) {
      try {
        // Ensure browser microphone permission is granted (works reliably across iframes too)
        if (navigator.mediaDevices?.getUserMedia) {
          const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          testStream.getTracks().forEach((t) => t.stop());
        }

        const recognition = new RecognitionCtor();
        recognition.lang = 'vi-VN';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
          let finalChunk = '';
          let interimChunk = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const phrase = event.results[i][0]?.transcript ?? '';
            if (event.results[i].isFinal) {
              finalChunk += `${phrase} `;
            } else {
              interimChunk += phrase;
            }
          }
          if (finalChunk.trim()) {
            onTranscriptRef.current(finalChunk.trim());
          }
          setInterimTranscript(interimChunk.trim());
        };

        recognition.onerror = (ev) => {
          if (ev.error === 'no-speech') return;
          if (ev.error === 'aborted') {
            setIsListening(false);
            return;
          }
          if (ev.error === 'not-allowed' || ev.error === 'audio-capture') {
            setMicError(describeMicFailure(new DOMException('', 'NotAllowedError')));
            setIsListening(false);
            recognitionRef.current = null;
            return;
          }
          // Fallback to audio recording + /api/transcribe on network/service errors
          recognitionRef.current = null;
          setIsListening(false);
          setInterimTranscript('');
          void startMediaRecorderFallback();
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript('');
          recognitionRef.current = null;
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        return;
      } catch (err) {
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'NotFoundError')) {
          setMicError(describeMicFailure(err));
          return;
        }
        // Otherwise try MediaRecorder fallback below
      }
    }

    await startMediaRecorderFallback();
  }, [isListening, startMediaRecorderFallback, stopAll]);

  return {
    isListening,
    isTranscribing,
    interimTranscript,
    micError,
    clearMicError: () => setMicError(''),
    toggleListening,
    stopListening: stopAll,
  };
}
