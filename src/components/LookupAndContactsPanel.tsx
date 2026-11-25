import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Contrast,
  Fingerprint,
  KeyRound,
  Phone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Signature,
  Trash2,
} from 'lucide-react';
import { FamilyGuardianSync } from './FamilyGuardianSync';
import type {
  AlertLevel,
  FamilyAlertEvent,
  FamilyChallengeConfig,
  FamilySyncRole,
  PhoneLookupResult,
  TrustedContact,
  UrlLookupResult,
  VietQrInfo,
} from '../types/safeai';

interface CommunityInsights {
  totalReports: number;
  uniqueCampaigns: number;
  topCategories: { category: string; count: number }[];
  recentFingerprints: {
    fingerprintPrefix: string;
    targetType: 'url' | 'message';
    count: number;
    lastReportedAt: string;
  }[];
}

interface FamilySyncPanelControls {
  status: 'disconnected' | 'connecting' | 'connected';
  roomCode: string;
  role: FamilySyncRole;
  memberName: string;
  parentCount: number;
  childCount: number;
  alerts: FamilyAlertEvent[];
  syncError: string;
  onCreateRoom: (role: FamilySyncRole, name: string) => void;
  onJoinRoom: (code: string, role: FamilySyncRole, name: string) => void;
  onLeaveRoom: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onSendTestAlert: () => void;
}

interface LookupAndContactsPanelProps {
  initialQuery?: string;
  trustedContacts: TrustedContact[];
  onAddContact: (label: string, identifier: string, kind: 'trusted' | 'blocked') => void;
  onDeleteContact: (id: string) => void;
  sosNumbers: [string, string];
  onSaveSosNumbers: (sos: [string, string]) => void;
  familyChallenge: FamilyChallengeConfig;
  onSaveFamilyChallenge: (cfg: FamilyChallengeConfig) => void;
  highContrast: boolean;
  onToggleHighContrast: (next: boolean) => void;
  familySync?: FamilySyncPanelControls;
}

export function LookupAndContactsPanel({
  initialQuery = '',
  trustedContacts,
  onAddContact,
  onDeleteContact,
  sosNumbers,
  onSaveSosNumbers,
  familyChallenge,
  onSaveFamilyChallenge,
  highContrast,
  onToggleHighContrast,
  familySync,
}: LookupAndContactsPanelProps) {
  const [lookupInput, setLookupInput] = useState(initialQuery);
  const [urlResult, setUrlResult] = useState<UrlLookupResult | null>(null);
  const [phoneResult, setPhoneResult] = useState<PhoneLookupResult | null>(null);
  const [vietQrLookup, setVietQrLookup] = useState<{
    vietQr: VietQrInfo;
    risk: { alertLevel: AlertLevel; matchesTrusted: boolean; matchesBlocked: boolean; warnings: string[] };
  } | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);

  const [sigText, setSigText] = useState('');
  const [sigResult, setSigResult] = useState<{ valid: boolean; message: string } | null>(null);

  const [contactLabel, setContactLabel] = useState('');
  const [contactIdentifier, setContactIdentifier] = useState('');
  const [contactKind, setContactKind] = useState<'trusted' | 'blocked'>('trusted');

  const [sos1, setSos1] = useState(sosNumbers[0]);
  const [sos2, setSos2] = useState(sosNumbers[1]);
  const [sosSaved, setSosSaved] = useState('');

  // Family Challenge Phrase state
  const [challengeQuestion, setChallengeQuestion] = useState(familyChallenge.question);
  const [challengeHint, setChallengeHint] = useState(familyChallenge.answerHint);
  const [challengeSaved, setChallengeSaved] = useState('');

  // Privacy-preserving HMAC campaign report state
  const [campaignType, setCampaignType] = useState<'url' | 'message'>('url');
  const [campaignValue, setCampaignValue] = useState('');
  const [campaignCategory, setCampaignCategory] = useState('Giả mạo ngân hàng / OTP');
  const [campaignNotice, setCampaignNotice] = useState('');
  const [insights, setInsights] = useState<CommunityInsights | null>(null);

  useEffect(() => {
    if (initialQuery) {
      setLookupInput(initialQuery);
      void runLookup(initialQuery);
    }
  }, [initialQuery]);

  useEffect(() => {
    void refreshInsights();
  }, []);

  async function refreshInsights() {
    try {
      const res = await fetch('/api/community/insights');
      if (res.ok) {
        const data = (await res.json()) as CommunityInsights;
        setInsights(data);
      }
    } catch {
      // ignore transient error
    }
  }

  async function runLookup(target?: string) {
    const query = (target ?? lookupInput).trim();
    if (!query) {
      setLookupError('Vui lòng nhập đường link hoặc số điện thoại cần kiểm tra.');
      return;
    }

    setLookupError('');
    setUrlResult(null);
    setPhoneResult(null);
    setVietQrLookup(null);
    setIsLookingUp(true);

    const looksLikeVietQr = query.startsWith('000201');
    const looksLikeUrl = !looksLikeVietQr && /https?:\/\/|\.[a-z]{2,}/i.test(query) && !/^\+?[\d\s.-]{8,15}$/.test(query);

    try {
      if (looksLikeVietQr) {
        const res = await fetch('/api/lookup/vietqr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payload: query, trustedContacts }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không giải mã được chuỗi VietQR.');
        setVietQrLookup(data);
      } else if (looksLikeUrl) {
        const res = await fetch('/api/lookup/url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: query }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không tra cứu được đường link.');
        setUrlResult(data);
      } else {
        const res = await fetch(`/api/lookup/phone?phone=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không tra cứu được số điện thoại.');
        setPhoneResult(data);
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'Lỗi tra cứu.');
    } finally {
      setIsLookingUp(false);
    }
  }

  async function handleReportPhone() {
    if (!phoneResult) return;
    try {
      const res = await fetch('/api/lookup/phone/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneResult.phone, category: 'Nghi vấn lừa đảo' }),
      });
      const data = await res.json();
      if (res.ok) {
        setPhoneResult(data);
      }
    } catch {
      // ignore transient error
    }
  }

  async function handleReportCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignValue.trim()) return;
    setCampaignNotice('');
    try {
      const res = await fetch('/api/lookup/campaign/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: campaignType,
          value: campaignValue.trim(),
          category: campaignCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCampaignNotice(data.error || 'Không gửi được báo cáo.');
        return;
      }
      setCampaignValue('');
      setCampaignNotice(
        `Đã ghi nhận mã băm ẩn danh fp-${data.fingerprintPrefix} (${data.count} lượt báo cáo). ${data.privacyNote}`
      );
      await refreshInsights();
    } catch {
      setCampaignNotice('Chưa thể kết nối máy chủ để ghi nhận báo cáo.');
    }
  }

  async function handleVerifySignature() {
    if (!sigText.trim()) return;
    const res = await fetch('/api/verify-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: sigText }),
    });
    const data = await res.json();
    setSigResult(data);
  }

  function handleSubmitContact(e: React.FormEvent) {
    e.preventDefault();
    if (!contactLabel.trim()) return;
    onAddContact(contactLabel.trim(), contactIdentifier.trim(), contactKind);
    setContactLabel('');
    setContactIdentifier('');
  }

  function handleSaveSos(e: React.FormEvent) {
    e.preventDefault();
    onSaveSosNumbers([sos1.trim(), sos2.trim()]);
    setSosSaved('Đã lưu 2 số liên hệ khẩn cấp.');
    setTimeout(() => setSosSaved(''), 3000);
  }

  function handleSaveChallenge(e: React.FormEvent) {
    e.preventDefault();
    onSaveFamilyChallenge({
      question: challengeQuestion.trim(),
      answerHint: challengeHint.trim(),
    });
    setChallengeSaved('Đã lưu câu hỏi bí mật gia đình trên thiết bị này.');
    setTimeout(() => setChallengeSaved(''), 3000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <div className="space-y-6 lg:col-span-7">
        {/* URL & Phone Lookup + Redirect Unmasking */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold text-slate-900">Tra cứu số điện thoại hoặc đường link</h2>
          <p className="mt-1 text-base text-slate-600">
            Nhập số điện thoại lạ, đường link trong tin nhắn hoặc mã QR chuyển khoản để kiểm tra xem có dấu hiệu lừa đảo không.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void runLookup();
            }}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="lookup-query-input" className="sr-only">
              Đường link hoặc số điện thoại
            </label>
            <input
              id="lookup-query-input"
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Ví dụ: 0999888777 hoặc https://..."
              className="min-h-[52px] flex-1 rounded-xl border border-slate-300 px-4 text-base text-slate-900"
            />
            <button
              type="submit"
              disabled={isLookingUp}
              className="min-h-[52px] shrink-0 rounded-xl bg-blue-700 px-6 text-base font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {isLookingUp ? 'Đang tra cứu...' : 'Tra cứu ngay'}
            </button>
          </form>

          {lookupError && (
            <p className="mt-3 text-base font-medium text-red-700" role="alert">
              {lookupError}
            </p>
          )}

          {vietQrLookup && (() => {
            const qrTone =
              vietQrLookup.risk.alertLevel === 'red'
                ? 'border-2 border-red-500 bg-red-50 text-red-950'
                : vietQrLookup.risk.alertLevel === 'green'
                  ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-950'
                  : 'border-2 border-orange-500 bg-orange-50 text-orange-950';
            return (
              <div className={`mt-5 rounded-xl p-4 shadow-xs ${qrTone}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold">
                    <Building2 className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>
                      VietQR: {vietQrLookup.vietQr.bankShortName} · STK {vietQrLookup.vietQr.accountNumber || '—'}
                    </span>
                  </div>
                  <span className="rounded-md bg-white/80 px-2 py-0.5 text-xs font-extrabold">
                    {vietQrLookup.vietQr.crcValid ? 'CRC-16 hợp lệ' : 'CRC-16 lỗi'}
                  </span>
                </div>
                {vietQrLookup.vietQr.amountFormatted && (
                  <p className="mt-1.5 text-sm font-bold">
                    Số tiền cài sẵn: {vietQrLookup.vietQr.amountFormatted}
                  </p>
                )}
                {vietQrLookup.vietQr.purpose && (
                  <p className="mt-1 text-sm">Nội dung: {vietQrLookup.vietQr.purpose}</p>
                )}
                {vietQrLookup.risk.warnings.map((w) => (
                  <p key={w} className="mt-2 text-sm font-semibold">
                    • {w}
                  </p>
                ))}
              </div>
            );
          })()}

          {urlResult && (() => {
            const urlTone =
              urlResult.status === 'danger'
                ? {
                    card: 'border-2 border-red-500 bg-red-50 text-red-950',
                    header: 'bg-red-600 text-white',
                    label: 'MỨC ĐỎ',
                    headline: 'Cảnh báo Đỏ: Đường link có dấu hiệu giả mạo hoặc nguy hiểm',
                    Icon: ShieldAlert,
                  }
                : urlResult.status === 'safe_signal'
                  ? {
                      card: 'border-2 border-emerald-500 bg-emerald-50 text-emerald-950',
                      header: 'bg-emerald-600 text-white',
                      label: 'MỨC XANH',
                      headline: 'An toàn (Xanh): Khớp tên miền chính thức đã biết',
                      Icon: ShieldCheck,
                    }
                  : {
                      card: 'border-2 border-orange-500 bg-orange-50 text-orange-950',
                      header: 'bg-orange-500 text-white',
                      label: 'MỨC CAM',
                      headline:
                        urlResult.status === 'suspicious'
                          ? 'Cảnh báo Cam: Đường link đáng ngờ, chưa nên bấm'
                          : 'Cảnh báo Cam: Chưa đủ dữ liệu xác minh — cần tự mở app chính thức',
                      Icon: AlertTriangle,
                    };
            const UrlIcon = urlTone.Icon;
            return (
              <div className={`mt-5 overflow-hidden rounded-xl shadow-xs ${urlTone.card}`}>
                <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${urlTone.header}`}>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <UrlIcon className="h-6 w-6 shrink-0" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-base font-bold">{urlTone.headline}</p>
                      <p className="font-mono text-xs text-white/90">{urlResult.hostname}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-white/40 bg-black/15 px-2 py-0.5 text-xs font-extrabold">
                    {urlTone.label}
                  </span>
                </div>

                <div className="space-y-3 p-4">
                  {urlResult.hasApkPayload && (
                    <div className="rounded-lg border-2 border-red-500 bg-red-100 p-3 text-sm font-bold text-red-900">
                      CẢNH BÁO TỆP CÀI ĐẶT ĐỘC HẠI (.APK): Tuyệt đối không tải hay cài đặt tệp từ liên kết này lên điện thoại!
                    </div>
                  )}

                  {urlResult.redirectChain && urlResult.redirectChain.length > 1 && (
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-bold text-slate-700">
                        Chuỗi chuyển hướng đã mở lớp ({urlResult.redirectChain.length} bước):
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-mono text-slate-800">
                        {urlResult.redirectChain.map((hop, idx) => (
                          <span key={hop + idx} className="inline-flex items-center gap-1 break-all">
                            {idx > 0 && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                            <span>{hop}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <ul className="list-disc space-y-1 pl-5 text-base">
                    {urlResult.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })()}

          {phoneResult && (() => {
            const phoneTone =
              phoneResult.reportCount >= 5
                ? {
                    card: 'border-2 border-red-500 bg-red-50 text-red-950',
                    header: 'bg-red-600 text-white',
                    label: 'NGUY HIỂM · ĐỎ',
                  }
                : phoneResult.reportCount >= 1
                  ? {
                      card: 'border-2 border-orange-500 bg-orange-50 text-orange-950',
                      header: 'bg-orange-500 text-white',
                      label: 'ĐÁNG NGỜ · CAM',
                    }
                  : {
                      card: 'border-2 border-emerald-500 bg-emerald-50 text-emerald-950',
                      header: 'bg-emerald-600 text-white',
                      label: 'CHƯA GHI NHẬN · XANH',
                    };
            return (
              <div className={`mt-5 overflow-hidden rounded-xl shadow-xs ${phoneTone.card}`}>
                <div className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 ${phoneTone.header}`}>
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="font-mono text-lg font-bold tabular-nums">{phoneResult.phone}</span>
                  </div>
                  <span className="rounded-md border border-white/40 bg-black/15 px-2.5 py-0.5 text-xs font-extrabold tabular-nums">
                    {phoneTone.label} · {phoneResult.reportCount} báo cáo
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-base">{phoneResult.communityNote}</p>
                  {Object.keys(phoneResult.categories).length > 0 && (
                    <p className="mt-2 text-sm opacity-90">
                      Phân loại:{' '}
                      {Object.entries(phoneResult.categories)
                        .map(([cat, count]) => `${cat} (${count})`)
                        .join(' · ')}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleReportPhone}
                    className="mt-3 min-h-[44px] rounded-xl border border-red-400 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    Báo cáo số này có dấu hiệu lừa đảo
                  </button>
                </div>
              </div>
            );
          })()}
        </section>

        {/* Advanced Security & Privacy Tools (collapsed for simplicity) */}
        <details className="rounded-2xl border border-slate-200 bg-white">
          <summary className="flex min-h-[54px] cursor-pointer items-center justify-between gap-3 px-6 py-4 text-base font-bold text-slate-900">
            <span>Công cụ nâng cao (dành cho con cháu / quản trị)</span>
            <span className="text-sm font-medium text-slate-500">Báo cáo ẩn danh · Chữ ký số</span>
          </summary>

          <div className="space-y-6 border-t border-slate-100 p-6">
            <section>
              <div className="flex items-center gap-2.5">
                <Fingerprint className="h-5 w-5 text-blue-700" aria-hidden="true" />
                <h3 className="text-lg font-bold text-slate-900">Báo cáo cộng đồng ẩn danh (Zero-PII)</h3>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Nội dung hoặc link đáng ngờ sẽ được chuyển thành mã băm bảo mật một chiều HMAC-SHA-256 trước khi thống kê — hoàn toàn không lưu nội dung riêng tư.
              </p>

              <form onSubmit={handleReportCampaign} className="mt-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="campaign-type" className="block text-sm font-semibold text-slate-700">
                      Loại dấu hiệu
                    </label>
                    <select
                      id="campaign-type"
                      value={campaignType}
                      onChange={(e) => setCampaignType(e.target.value as 'url' | 'message')}
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                    >
                      <option value="url">Đường link giả mạo</option>
                      <option value="message">Mẫu tin nhắn lừa đảo</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="campaign-cat" className="block text-sm font-semibold text-slate-700">
                      Nhóm thủ đoạn
                    </label>
                    <select
                      id="campaign-cat"
                      value={campaignCategory}
                      onChange={(e) => setCampaignCategory(e.target.value)}
                      className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                    >
                      <option value="Giả mạo ngân hàng / OTP">Giả mạo ngân hàng / OTP</option>
                      <option value="Biên lai đòi phí giải ngân">Biên lai đòi phí giải ngân</option>
                      <option value="Link .apk / VNeID giả">Link .apk / VNeID giả</option>
                      <option value="Giả danh người thân">Giả danh người thân</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="campaign-val" className="block text-sm font-semibold text-slate-700">
                    Link hoặc mẫu tin nhắn cần báo cáo ẩn danh
                  </label>
                  <input
                    id="campaign-val"
                    type="text"
                    value={campaignValue}
                    onChange={(e) => setCampaignValue(e.target.value)}
                    placeholder="Ví dụ: https://vietcombank-xacthuc.xyz/otp"
                    className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base"
                  />
                </div>

                <button
                  type="submit"
                  className="min-h-[44px] rounded-xl bg-slate-900 px-5 text-base font-semibold text-white hover:bg-slate-800"
                >
                  Tạo mã băm &amp; đóng góp cảnh báo
                </button>
              </form>

              {campaignNotice && (
                <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900" role="status">
                  {campaignNotice}
                </p>
              )}

              {insights && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-bold text-slate-900 tabular-nums">
                    Thống kê cộng đồng ẩn danh: {insights.totalReports} lượt báo cáo · {insights.uniqueCampaigns} chiến dịch duy nhất
                  </p>
                  {insights.topCategories.length > 0 && (
                    <p className="mt-1.5 text-sm text-slate-700">
                      Xu hướng nổi bật:{' '}
                      {insights.topCategories.map((c) => `${c.category} (${c.count})`).join(' · ')}
                    </p>
                  )}
                  {insights.recentFingerprints.length > 0 && (
                    <div className="mt-2.5 space-y-1 text-xs font-mono text-slate-600">
                      {insights.recentFingerprints.slice(0, 3).map((fp) => (
                        <p key={fp.fingerprintPrefix} className="tabular-nums">
                          fp-{fp.fingerprintPrefix} · {fp.targetType.toUpperCase()} · {fp.count} lượt
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="border-t border-slate-100 pt-5">
              <div className="flex items-center gap-2.5">
                <Signature className="h-5 w-5 text-blue-700" aria-hidden="true" />
                <h3 className="text-lg font-bold text-slate-900">Kiểm tra chữ ký số nội dung</h3>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                Dán tin nhắn có gắn mã <span className="font-mono text-xs">[SAFEAI-SIG:...]</span> từ người thân để kiểm tra định dạng chữ ký.
              </p>
              <textarea
                rows={3}
                value={sigText}
                onChange={(e) => setSigText(e.target.value)}
                placeholder="Dán nội dung kèm mã [SAFEAI-SIG:...]"
                className="mt-3 w-full rounded-xl border border-slate-300 p-3 text-base text-slate-900"
              />
              <button
                type="button"
                onClick={handleVerifySignature}
                className="mt-3 min-h-[44px] rounded-xl border border-slate-300 bg-slate-50 px-4 py-2 text-base font-semibold text-slate-800 hover:bg-slate-100"
              >
                Kiểm tra chữ ký
              </button>
              {sigResult && (
                <div
                  className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-base ${
                    sigResult.valid ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
                  }`}
                >
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{sigResult.message}</span>
                </div>
              )}
            </section>
          </div>
        </details>
      </div>

      <div className="space-y-6 lg:col-span-5">
        {familySync && <FamilyGuardianSync {...familySync} />}

        {/* Display & Low-Vision Accessibility Settings */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Contrast className="h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
                <h2 id="inline-hc-label" className="text-xl font-bold text-slate-900">
                  Cài đặt hiển thị
                </h2>
              </div>
              <p className="mt-1 text-base text-slate-600">
                Bật <strong className="font-semibold text-slate-900">Chế độ tương phản cao</strong> để tăng độ đậm chữ, viền rõ nét và cỡ chữ dễ nhìn hơn cho người lớn tuổi.
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="text-base font-bold text-slate-900">Chế độ tương phản cao</span>
            <button
              type="button"
              role="switch"
              aria-checked={highContrast}
              aria-label="Chế độ tương phản cao"
              onClick={() => onToggleHighContrast(!highContrast)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl border px-3.5 text-sm font-bold transition-colors ${
                highContrast
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
              }`}
            >
              <span
                className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                  highContrast ? 'bg-white/30' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                    highContrast ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </span>
              <span>{highContrast ? 'Đang bật' : 'Đang tắt'}</span>
            </button>
          </div>
        </section>

        {/* Family Challenge Phrase */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-xl font-bold text-slate-900">Mật khẩu bí mật gia đình</h2>
          </div>
          <p className="mt-1 text-base text-slate-600">
            Chống giả giọng AI hoặc mạo danh con cháu nhắn tin mượn tiền gấp. Khi phát hiện tin nhắn người thân xin tiền, SafeAI sẽ nhắc Cụ hỏi câu này.
          </p>
          <form onSubmit={handleSaveChallenge} className="mt-4 space-y-3">
            <div>
              <label htmlFor="family-q" className="block text-sm font-semibold text-slate-700">
                Câu hỏi bí mật chỉ người nhà biết
              </label>
              <input
                id="family-q"
                type="text"
                value={challengeQuestion}
                onChange={(e) => setChallengeQuestion(e.target.value)}
                placeholder="Ví dụ: Con mèo đầu tiên nhà mình nuôi tên là gì?"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base"
              />
            </div>
            <div>
              <label htmlFor="family-hint" className="block text-sm font-semibold text-slate-700">
                Gợi ý đáp án (chỉ lưu trên máy Cụ)
              </label>
              <input
                id="family-hint"
                type="text"
                value={challengeHint}
                onChange={(e) => setChallengeHint(e.target.value)}
                placeholder="Ví dụ: Bông"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] w-full rounded-xl bg-blue-700 px-4 text-base font-semibold text-white hover:bg-blue-800"
            >
              Lưu mật khẩu gia đình
            </button>
            {challengeSaved && (
              <p className="text-sm font-semibold text-emerald-700" role="status">
                {challengeSaved}
              </p>
            )}
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold text-slate-900">Số liên hệ khẩn cấp (SOS)</h2>
          <p className="mt-1 text-base text-slate-600">
            Lưu tối đa 2 số điện thoại con cháu hoặc người thân để gọi nhanh khi gặp tình huống nguy hiểm.
          </p>
          <form onSubmit={handleSaveSos} className="mt-4 space-y-3">
            <div>
              <label htmlFor="sos-phone-1" className="block text-sm font-semibold text-slate-700">
                Người thân 1
              </label>
              <input
                id="sos-phone-1"
                type="tel"
                value={sos1}
                onChange={(e) => setSos1(e.target.value)}
                placeholder="Ví dụ: 0912345678"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base"
              />
            </div>
            <div>
              <label htmlFor="sos-phone-2" className="block text-sm font-semibold text-slate-700">
                Người thân 2
              </label>
              <input
                id="sos-phone-2"
                type="tel"
                value={sos2}
                onChange={(e) => setSos2(e.target.value)}
                placeholder="Ví dụ: 0987654321"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] w-full rounded-xl bg-slate-900 px-4 text-base font-semibold text-white hover:bg-slate-800"
            >
              Lưu số khẩn cấp
            </button>
            {sosSaved && (
              <p className="text-sm font-semibold text-emerald-700" role="status">
                {sosSaved}
              </p>
            )}
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold text-slate-900">Danh bạ đáng tin &amp; Danh sách đen</h2>
          <p className="mt-1 text-base text-slate-600">
            SafeAI tự động đối chiếu số và tên trong ảnh/tin nhắn với danh bạ này để cảnh báo mạo danh chính xác hơn.
          </p>

          <form onSubmit={handleSubmitContact} className="mt-4 space-y-3">
            <div>
              <label htmlFor="contact-label" className="block text-sm font-semibold text-slate-700">
                Tên gợi nhớ
              </label>
              <input
                id="contact-label"
                type="text"
                value={contactLabel}
                onChange={(e) => setContactLabel(e.target.value)}
                placeholder="Ví dụ: Con trai Minh, Vietcombank"
                className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-id" className="block text-sm font-semibold text-slate-700">
                  Số điện thoại (tùy chọn)
                </label>
                <input
                  id="contact-id"
                  type="text"
                  value={contactIdentifier}
                  onChange={(e) => setContactIdentifier(e.target.value)}
                  placeholder="0912345678"
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base"
                />
              </div>
              <div>
                <label htmlFor="contact-kind" className="block text-sm font-semibold text-slate-700">
                  Phân loại
                </label>
                <select
                  id="contact-kind"
                  value={contactKind}
                  onChange={(e) => setContactKind(e.target.value as 'trusted' | 'blocked')}
                  className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 text-base"
                >
                  <option value="trusted">Đáng tin</option>
                  <option value="blocked">Danh sách đen</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-base font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              <span>Thêm vào danh bạ</span>
            </button>
          </form>

          <div className="mt-5 divide-y divide-slate-100">
            {trustedContacts.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">Chưa có mục nào trong danh bạ.</p>
            ) : (
              trustedContacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{c.label}</p>
                    <p className="text-sm text-slate-600">
                      {c.kind === 'blocked' ? 'Danh sách đen' : 'Đáng tin'}
                      {c.identifier ? ` · ${c.identifier}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onDeleteContact(c.id)}
                    aria-label={`Xóa ${c.label}`}
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
