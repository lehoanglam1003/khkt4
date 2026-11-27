import { useEffect, useRef, useState } from 'react';
import { PhoneCall } from 'lucide-react';
import { TopNav, type AppTab } from './components/TopNav';
import { LoginScreen } from './components/LoginScreen';
import { UnifiedSafeStudio } from './components/UnifiedSafeStudio';
import { LookupAndContactsPanel } from './components/LookupAndContactsPanel';
import { DiaryAndTrainingPanel } from './components/DiaryAndTrainingPanel';
import { EmergencyBrakeModal } from './components/EmergencyBrakeModal';
import { InteractiveGuideModal } from './components/InteractiveGuideModal';
import { OfflineBanner } from './components/PWAInstallButton';
import { RecoveryWizardModal } from './components/RecoveryWizardModal';
import { SettingsModal } from './components/SettingsModal';
import { useFamilySync } from './hooks/useFamilySync';
import type { GuideTopic } from './shared/guideContent';
import { splitVietnameseSpeechChunks } from './shared/speechUtils';
import {
  GLOBAL_HIGH_CONTRAST_KEY,
  applyHighContrastToRoot,
  getUserHighContrastKey,
  resolveHighContrastPreference,
} from './utils/accessibilitySettings';
import type {
  ChatMessage,
  DiaryEntry,
  FamilyChallengeConfig,
  ScanResult,
  TrainingProgress,
  TrustedContact,
  UserAccount,
  VoiceRegion,
} from './types/safeai';

const AUTH_TOKEN_KEY = 'safeai_auth_token_v2';
const GUEST_USER_KEY = 'safeai_guest_mode_v2';

function userStorageKeys(phone: string) {
  const scope = phone || 'guest';
  return {
    diary: `safeai_diary_v2_${scope}`,
    contacts: `safeai_contacts_v2_${scope}`,
    sos: `safeai_sos_v2_${scope}`,
    training: `safeai_training_v2_${scope}`,
    voiceRegion: `safeai_voice_region_v2_${scope}`,
    familyChallenge: `safeai_family_challenge_v2_${scope}`,
  };
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const DEFAULT_BLOCKED_CONTACT: TrustedContact = {
  id: 'seed-1',
  label: 'Số giả mạo tổng đài ngân hàng',
  identifier: '0999888777',
  kind: 'blocked',
  createdAt: '2026-11-01T00:00:00.000Z',
};

const DEFAULT_CHALLENGE: FamilyChallengeConfig = {
  question: 'Con mèo hoặc thú cưng đầu tiên của nhà mình tên là gì?',
  answerHint: '',
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('scan');
  const [latestScan, setLatestScan] = useState<ScanResult | null>(null);
  const [lookupInitialQuery, setLookupInitialQuery] = useState('');
  const [scannerPrefillText, setScannerPrefillText] = useState('');

  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [trustedContacts, setTrustedContacts] = useState<TrustedContact[]>([DEFAULT_BLOCKED_CONTACT]);
  const [sosNumbers, setSosNumbers] = useState<[string, string]>(['', '']);
  const [trainingProgress, setTrainingProgress] = useState<Record<string, TrainingProgress>>({});
  const [voiceRegion, setVoiceRegion] = useState<VoiceRegion>('auto');
  const [familyChallenge, setFamilyChallenge] = useState<FamilyChallengeConfig>(DEFAULT_CHALLENGE);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: 'Cháu chào Cụ! Cụ có thể hỏi cháu về bất kỳ tin nhắn, cuộc gọi hay ảnh chụp nào đáng nghi, hoặc bấm nút micro để nói chuyện trực tiếp nhé.',
      alertLevel: 'green',
      createdAt: new Date().toISOString(),
    },
  ]);

  const [brakeModalOpen, setBrakeModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [guideModalOpen, setGuideModalOpen] = useState(false);
  const [guideInitialTopic, setGuideInitialTopic] = useState<GuideTopic>('overview');
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [recoveryScan, setRecoveryScan] = useState<ScanResult | null>(null);
  const [sharedImageBlob, setSharedImageBlob] = useState<Blob | null>(null);
  const [activeBrakeEntry, setActiveBrakeEntry] = useState<DiaryEntry | null>(null);
  const [toastNotice, setToastNotice] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('safeai_auto_speak_v2');
      return saved === null ? true : saved === '1';
    } catch {
      return true;
    }
  });
  const [highContrast, setHighContrast] = useState<boolean>(() => {
    try {
      return resolveHighContrastPreference(null, localStorage.getItem(GLOBAL_HIGH_CONTRAST_KEY));
    } catch {
      return false;
    }
  });
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakRequestIdRef = useRef(0);

  const familySync = useFamilySync(
    currentUser?.phone || 'guest',
    currentUser?.displayName || 'Người dùng SafeAI'
  );

  // Consume Web Share Target params & cached shared image on startup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedText = params.get('text');
    const sharedFlag = params.get('shared');
    if (sharedText) {
      setScannerPrefillText(sharedText);
      setActiveTab('scan');
    }
    if (sharedFlag === '1' && 'caches' in window) {
      void (async () => {
        try {
          const cache = await caches.open('safeai-share-target-v1');
          const match = await cache.match('/__shared-image');
          if (match) {
            const blob = await match.blob();
            if (blob.size > 0) {
              setSharedImageBlob(blob);
              setActiveTab('scan');
            }
            await cache.delete('/__shared-image');
          }
        } catch {
          // ignore cache read failures
        }
      })();
    }
    if (sharedFlag || sharedText) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Always land directly on the Login screen when entering the app
  // (saved diary, contacts, and SOS numbers are restored once the user selects or enters an account).

  // Load user-scoped data whenever currentUser changes
  useEffect(() => {
    if (!currentUser) return;
    const keys = userStorageKeys(currentUser.phone);
    setDiaryEntries(loadJson<DiaryEntry[]>(keys.diary, []));
    setTrustedContacts(loadJson<TrustedContact[]>(keys.contacts, [DEFAULT_BLOCKED_CONTACT]));
    setSosNumbers(loadJson<[string, string]>(keys.sos, ['', '']));
    setTrainingProgress(loadJson<Record<string, TrainingProgress>>(keys.training, {}));
    setVoiceRegion(loadJson<VoiceRegion>(keys.voiceRegion, 'auto'));
    setFamilyChallenge(loadJson<FamilyChallengeConfig>(keys.familyChallenge, DEFAULT_CHALLENGE));
    const hcPref = resolveHighContrastPreference(
      localStorage.getItem(getUserHighContrastKey(currentUser.phone)),
      localStorage.getItem(GLOBAL_HIGH_CONTRAST_KEY)
    );
    setHighContrast(hcPref);
  }, [currentUser?.phone]);

  useEffect(() => {
    applyHighContrastToRoot(document.documentElement, highContrast);
    try {
      localStorage.setItem(GLOBAL_HIGH_CONTRAST_KEY, highContrast ? '1' : '0');
      if (currentUser) {
        localStorage.setItem(getUserHighContrastKey(currentUser.phone), highContrast ? '1' : '0');
      }
    } catch {
      // ignore storage errors
    }
  }, [highContrast, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(userStorageKeys(currentUser.phone).diary, JSON.stringify(diaryEntries));
  }, [diaryEntries, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(userStorageKeys(currentUser.phone).contacts, JSON.stringify(trustedContacts));
  }, [trustedContacts, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(userStorageKeys(currentUser.phone).sos, JSON.stringify(sosNumbers));
  }, [sosNumbers, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(userStorageKeys(currentUser.phone).training, JSON.stringify(trainingProgress));
  }, [trainingProgress, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(userStorageKeys(currentUser.phone).voiceRegion, JSON.stringify(voiceRegion));
  }, [voiceRegion, currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    localStorage.setItem(userStorageKeys(currentUser.phone).familyChallenge, JSON.stringify(familyChallenge));
  }, [familyChallenge, currentUser]);

  function showToast(msg: string) {
    setToastNotice(msg);
    setTimeout(() => setToastNotice(''), 4000);
  }

  function handleAuthenticated(user: UserAccount, token?: string) {
    localStorage.removeItem(GUEST_USER_KEY);
    if (token) {
      localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    setCurrentUser(user);
    setLatestScan(null);
    setActiveTab('scan');
  }

  function handleContinueAsGuest() {
    localStorage.setItem(GUEST_USER_KEY, '1');
    setCurrentUser({ phone: 'guest', displayName: 'Khách thử nghiệm', isGuest: true });
    setActiveTab('scan');
  }

  async function handleLogout() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(GUEST_USER_KEY);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setLatestScan(null);
  }

  function handleScanComplete(result: ScanResult) {
    setLatestScan(result);
    const newEntry: DiaryEntry = {
      id: result.id,
      createdAt: result.createdAt,
      sourceMode: result.sourceMode,
      sourceText:
        result.extractedText || result.extractedEntities.qrPayload || result.summary,
      scamType: result.scamType,
      reply: result.reply,
      alertLevel: result.alertLevel,
      status: result.alertLevel === 'green' ? 'da_an_toan' : 'moi_ghi_nhan',
      notes: '',
      checklist: [],
      situationKey: 'chua_thao_tac',
    };
    setDiaryEntries((prev) => [newEntry, ...prev].slice(0, 60));

    if (
      result.alertLevel === 'red' &&
      familySync.status === 'connected' &&
      familySync.role === 'parent'
    ) {
      const rawExcerpt = (result.extractedText || result.userContext || '').replace(/\s+/g, ' ').trim();
      const quotedExcerpt = rawExcerpt ? ` — Nội dung: "${rawExcerpt.slice(0, 140)}${rawExcerpt.length > 140 ? '...' : ''}"` : '';
      familySync.sendFamilyAlert({
        id: result.id,
        alertLevel: 'red',
        scamType: result.scamType,
        summary: `${result.summary}${quotedExcerpt}`,
        entitiesSummary: [
          ...result.extractedEntities.urls,
          ...result.extractedEntities.phones,
          ...result.extractedEntities.bankAccounts,
        ]
          .slice(0, 4)
          .join(' · '),
      });
    }
  }

  function stopSpeaking() {
    speakRequestIdRef.current += 1;
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }

  function primeAudioPlayback() {
    if (typeof Audio === 'undefined') return;
    if (!ttsAudioRef.current) {
      ttsAudioRef.current = new Audio();
    }
    try {
      // Unlock HTMLAudioElement within user gesture for subsequent async playback
      ttsAudioRef.current.src =
        'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      const p = ttsAudioRef.current.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => undefined);
      }
    } catch {
      // ignore if browser ignores silent priming
    }
  }

  function toggleAutoSpeak(next: boolean) {
    setAutoSpeak(next);
    try {
      localStorage.setItem('safeai_auto_speak_v2', next ? '1' : '0');
    } catch {
      // ignore
    }
    if (!next) {
      stopSpeaking();
    }
    showToast(next ? 'Đã bật tự động đọc phản hồi.' : 'Đã tắt tự động đọc phản hồi.');
  }

  function speakWithBrowserSynthesis(cleanText: string, region: VoiceRegion, reqId: number): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      const chunks = splitVietnameseSpeechChunks(cleanText, 160);
      if (chunks.length === 0) return false;

      const voices = window.speechSynthesis.getVoices();
      const viVoice = voices.find((v) => v.lang.toLowerCase().startsWith('vi'));

      setIsSpeaking(true);
      chunks.forEach((chunk, idx) => {
        const utter = new SpeechSynthesisUtterance(chunk);
        utter.lang = 'vi-VN';
        if (viVoice) utter.voice = viVoice;
        utter.rate = 0.94;
        if (region === 'nam') utter.pitch = 1.04;
        if (region === 'trung') utter.pitch = 0.98;
        if (idx === chunks.length - 1) {
          utter.onend = () => {
            if (speakRequestIdRef.current === reqId) setIsSpeaking(false);
          };
          utter.onerror = () => {
            if (speakRequestIdRef.current === reqId) setIsSpeaking(false);
          };
        }
        window.speechSynthesis.speak(utter);
      });
      return true;
    } catch {
      if (speakRequestIdRef.current === reqId) setIsSpeaking(false);
      return false;
    }
  }

  async function handleSpeakText(text: string, regionOverride?: VoiceRegion) {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean) return;
    const region = regionOverride ?? voiceRegion;

    stopSpeaking();
    primeAudioPlayback();
    const reqId = speakRequestIdRef.current;
    setIsSpeaking(true);

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean.slice(0, 950), voiceRegion: region }),
      });
      if (speakRequestIdRef.current !== reqId) return;

      if (res.ok) {
        const data = (await res.json()) as { audioBase64?: string; mimeType?: string };
        if (speakRequestIdRef.current !== reqId) return;
        if (data.audioBase64) {
          const audio = ttsAudioRef.current ?? new Audio();
          ttsAudioRef.current = audio;
          audio.src = `data:${data.mimeType || 'audio/mpeg'};base64,${data.audioBase64}`;
          audio.onended = () => {
            if (speakRequestIdRef.current === reqId) setIsSpeaking(false);
          };
          audio.onerror = () => {
            if (speakRequestIdRef.current !== reqId) return;
            const startedFallback = speakWithBrowserSynthesis(clean, region, reqId);
            if (!startedFallback) setIsSpeaking(false);
          };
          try {
            await audio.play();
            return;
          } catch {
            // Fall through cleanly to browser Web Speech if HTMLAudio playback was blocked
          }
        }
      }
    } catch {
      // fall through cleanly to Web Speech fallback
    }

    if (speakRequestIdRef.current !== reqId) return;
    const started = speakWithBrowserSynthesis(clean, region, reqId);
    if (!started) {
      setIsSpeaking(false);
      showToast('Thiết bị này chưa hỗ trợ phát giọng nói.');
    }
  }

  function handleTriggerSos() {
    if (familySync.status === 'connected' && familySync.role === 'parent') {
      familySync.sendFamilyAlert({
        id: `sos-${Date.now()}`,
        alertLevel: 'red',
        scamType: 'Bấm nút SOS Khẩn cấp',
        summary: `${currentUser?.displayName || 'Bố/Mẹ'} vừa bấm nút SOS Khẩn cấp trên SafeAI và cần hỗ trợ ngay!`,
      });
    }
    const firstSos = sosNumbers.find((s) => s.trim().length > 0);
    setActiveBrakeEntry(diaryEntries[0] ?? null);
    setBrakeModalOpen(true);
    if (firstSos) {
      showToast(`Đã mở bảng SOS — Số người thân: ${firstSos}`);
    } else {
      showToast('Đã mở bảng SOS khẩn cấp — Cụ có thể gọi 113 hoặc lưu số người thân ở mục Tra cứu.');
    }
  }

  function handleOpenBrakeForScan(scan: ScanResult) {
    const existing = diaryEntries.find((d) => d.id === scan.id) ?? null;
    setActiveBrakeEntry(existing);
    setBrakeModalOpen(true);
  }

  function handleSaveBrakeProgress(entryId: string | null, situationKey: string, checklist: string[]) {
    if (entryId) {
      setDiaryEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                situationKey,
                checklist,
                status: checklist.length >= 3 ? 'da_an_toan' : 'dang_xu_ly',
              }
            : e
        )
      );
    }
  }

  function handleRecordTraining(scenarioId: string, correct: boolean) {
    setTrainingProgress((prev) => {
      const current = prev[scenarioId];
      return {
        ...prev,
        [scenarioId]: {
          scenarioId,
          bestScore: Math.max(current?.bestScore ?? 0, correct ? 1 : 0),
          attempts: (current?.attempts ?? 0) + 1,
          lastCompletedAt: new Date().toISOString(),
        },
      };
    });
  }

  const guideModalElement = (
    <InteractiveGuideModal
      isOpen={guideModalOpen}
      initialTopic={guideInitialTopic}
      isLoggedIn={Boolean(currentUser)}
      onClose={() => {
        stopSpeaking();
        setGuideModalOpen(false);
      }}
      onGoToScanner={() => setActiveTab('scan')}
      onGoToVoiceShield={() => setActiveTab('scan')}
      onGoToLookup={() => setActiveTab('lookup')}
      onOpenSos={handleTriggerSos}
      onSpeakText={(txt) => void handleSpeakText(txt)}
      onStopSpeaking={stopSpeaking}
      isSpeaking={isSpeaking}
    />
  );

  if (!currentUser) {
    return (
      <>
        <LoginScreen
          onAuthenticated={handleAuthenticated}
          onContinueAsGuest={handleContinueAsGuest}
          onOpenGuide={() => {
            setGuideInitialTopic('overview');
            setGuideModalOpen(true);
          }}
        />
        {guideModalElement}
      </>
    );
  }

  return (
    <div id="top" className="min-h-screen bg-[#F4F7FB] pb-36 text-slate-900 md:pb-28">
      <OfflineBanner />
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onTriggerSos={handleTriggerSos}
        diaryCount={diaryEntries.length}
        currentUser={currentUser}
        onLogout={() => void handleLogout()}
        onOpenSettings={() => setSettingsModalOpen(true)}
        onOpenGuide={() => {
          setGuideInitialTopic('overview');
          setGuideModalOpen(true);
        }}
      />

      {familySync.latestIncomingAlert && (() => {
        const isOrangeBanner = familySync.latestIncomingAlert.alertLevel === 'orange';
        return (
          <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
            <div
              role="alert"
              className={`flex flex-col gap-3 rounded-2xl border-2 px-5 py-4 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between ${
                isOrangeBanner
                  ? 'border-orange-700 bg-orange-600'
                  : 'border-red-700 bg-red-600'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-extrabold uppercase tracking-wider ${
                    isOrangeBanner ? 'text-orange-100' : 'text-red-100'
                  }`}
                >
                  Cảnh báo Gia đình thời gian thực · Phòng {familySync.roomCode}
                </p>
                <p className="mt-0.5 text-lg font-extrabold leading-snug">
                  {familySync.latestIncomingAlert.senderName}: {familySync.latestIncomingAlert.scamType}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-white/95">
                  {familySync.latestIncomingAlert.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <button
                  type="button"
                  onClick={() => familySync.acknowledgeAlert(familySync.latestIncomingAlert!.id)}
                  className={`min-h-[44px] rounded-xl bg-white px-4 text-sm font-bold hover:bg-slate-50 ${
                    isOrangeBanner ? 'text-orange-800' : 'text-red-700'
                  }`}
                >
                  Xác nhận đã hỗ trợ
                </button>
                <button
                  type="button"
                  onClick={familySync.dismissIncomingBanner}
                  className={`min-h-[44px] rounded-xl border border-white/40 px-3 text-sm font-semibold text-white ${
                    isOrangeBanner ? 'hover:bg-orange-700' : 'hover:bg-red-700'
                  }`}
                >
                  Ẩn bớt
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {toastNotice && (
        <div className="mx-auto mt-4 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            role="status"
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-base font-medium text-blue-950"
          >
            {toastNotice}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {activeTab === 'scan' && (
          <UnifiedSafeStudio
            senderName={currentUser.displayName}
            trustedContacts={trustedContacts}
            familyChallenge={familyChallenge}
            sosNumbers={sosNumbers}
            latestScan={latestScan}
            onScanComplete={handleScanComplete}
            onOpenEmergencyBrake={handleOpenBrakeForScan}
            onOpenRecoveryWizard={(scan) => {
              setRecoveryScan(scan);
              setRecoveryModalOpen(true);
            }}
            onOpenGuide={(topic) => {
              setGuideInitialTopic(topic);
              setGuideModalOpen(true);
            }}
            onLookupEntity={(query) => {
              setLookupInitialQuery(query);
              setActiveTab('lookup');
            }}
            onSpeakText={(txt) => void handleSpeakText(txt)}
            onStopSpeaking={stopSpeaking}
            isSpeaking={isSpeaking}
            autoSpeak={autoSpeak}
            onToggleAutoSpeak={toggleAutoSpeak}
            onPrimeAudio={primeAudioPlayback}
            prefilledText={scannerPrefillText}
            sharedImageBlob={sharedImageBlob}
            onConsumeSharedImage={() => setSharedImageBlob(null)}
            messages={chatMessages}
            onAppendMessage={(msg) => setChatMessages((prev) => [...prev, msg])}
          />
        )}

        {activeTab === 'lookup' && (
          <LookupAndContactsPanel
            initialQuery={lookupInitialQuery}
            trustedContacts={trustedContacts}
            onAddContact={(label, identifier, kind) =>
              setTrustedContacts((prev) => [
                {
                  id: `c-${Date.now()}`,
                  label,
                  identifier,
                  kind,
                  createdAt: new Date().toISOString(),
                },
                ...prev,
              ])
            }
            onDeleteContact={(id) =>
              setTrustedContacts((prev) => prev.filter((c) => c.id !== id))
            }
            sosNumbers={sosNumbers}
            onSaveSosNumbers={setSosNumbers}
            familyChallenge={familyChallenge}
            onSaveFamilyChallenge={setFamilyChallenge}
            highContrast={highContrast}
            onToggleHighContrast={(next) => {
              setHighContrast(next);
              showToast(next ? 'Đã bật Chế độ tương phản cao.' : 'Đã tắt Chế độ tương phản cao.');
            }}
            familySync={{
              status: familySync.status,
              roomCode: familySync.roomCode,
              role: familySync.role,
              memberName: familySync.memberName,
              parentCount: familySync.parentCount,
              childCount: familySync.childCount,
              alerts: familySync.alerts,
              syncError: familySync.syncError,
              onCreateRoom: familySync.createRoom,
              onJoinRoom: familySync.joinRoom,
              onLeaveRoom: familySync.leaveRoom,
              onAcknowledgeAlert: familySync.acknowledgeAlert,
              onSendTestAlert: () => {
                const sent = familySync.sendFamilyAlert({
                  alertLevel: 'orange',
                  scamType: 'Tín hiệu kiểm tra kết nối gia đình',
                  summary: 'Thiết bị đang hoạt động bình thường và kết nối với phòng gia đình.',
                });
                if (sent) showToast('Đã gửi tín hiệu kiểm tra tới các thiết bị trong gia đình.');
              },
            }}
          />
        )}

        {activeTab === 'diary' && (
          <DiaryAndTrainingPanel
            entries={diaryEntries}
            onUpdateEntry={(id, patch) =>
              setDiaryEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
            }
            onDeleteEntry={(id) =>
              setDiaryEntries((prev) => prev.filter((e) => e.id !== id))
            }
            onOpenEmergencyBrake={(entry) => {
              setActiveBrakeEntry(entry);
              setBrakeModalOpen(true);
            }}
            trainingProgress={trainingProgress}
            onRecordTrainingAttempt={handleRecordTraining}
            onSpeakText={(txt) => void handleSpeakText(txt)}
          />
        )}
      </main>

      <EmergencyBrakeModal
        isOpen={brakeModalOpen}
        entry={activeBrakeEntry}
        sosNumbers={sosNumbers}
        voiceRegion={voiceRegion}
        onChangeVoiceRegion={setVoiceRegion}
        onClose={() => setBrakeModalOpen(false)}
        onSaveProgress={handleSaveBrakeProgress}
        onSpeakText={handleSpeakText}
        onOpenRecoveryWizard={() => {
          setRecoveryScan(latestScan);
          setRecoveryModalOpen(true);
        }}
        onOpenContacts={() => setActiveTab('lookup')}
      />

      <RecoveryWizardModal
        isOpen={recoveryModalOpen}
        scan={recoveryScan ?? latestScan}
        sosNumbers={sosNumbers}
        onClose={() => setRecoveryModalOpen(false)}
      />

      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        highContrast={highContrast}
        onToggleHighContrast={(next) => {
          setHighContrast(next);
          showToast(next ? 'Đã bật Chế độ tương phản cao.' : 'Đã tắt Chế độ tương phản cao.');
        }}
        autoSpeak={autoSpeak}
        onToggleAutoSpeak={toggleAutoSpeak}
        voiceRegion={voiceRegion}
        onChangeVoiceRegion={setVoiceRegion}
        onOpenFamilySettings={() => setActiveTab('lookup')}
        onOpenGuide={() => {
          setGuideInitialTopic('overview');
          setGuideModalOpen(true);
        }}
        currentUser={currentUser}
        onLogout={() => void handleLogout()}
      />

      {guideModalElement}

      {!brakeModalOpen && !recoveryModalOpen && !guideModalOpen && !settingsModalOpen && (
        <button
          type="button"
          onClick={handleTriggerSos}
          aria-label="SOS Khẩn cấp — Mở hỗ trợ khẩn cấp và gọi người thân ngay"
          className="fixed bottom-20 right-4 z-40 inline-flex min-h-[60px] items-center gap-3 rounded-2xl border-4 border-white bg-red-700 px-5 py-3 text-white shadow-2xl ring-2 ring-slate-900/35 transition-transform hover:bg-red-800 active:scale-[0.98] md:bottom-6 md:right-6 md:min-h-[64px] md:px-6"
        >
          <PhoneCall className="h-6 w-6 shrink-0 stroke-[2.5]" aria-hidden="true" />
          <span className="whitespace-nowrap text-lg font-extrabold tracking-wide">
            SOS Khẩn cấp
          </span>
        </button>
      )}
    </div>
  );
}
