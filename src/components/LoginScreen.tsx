import { useState } from 'react';
import {
  CheckCircle2,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  Phone,
  ShieldCheck,
  User,
  UserCheck,
} from 'lucide-react';
import type { UserAccount } from '../types/safeai';

interface LoginScreenProps {
  onAuthenticated: (user: UserAccount, token?: string) => void;
  onContinueAsGuest: () => void;
}

type AuthMode = 'login' | 'register' | 'reset';

export function LoginScreen({ onAuthenticated, onContinueAsGuest }: LoginScreenProps) {
  const [showPhoneAuth, setShowPhoneAuth] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [demoCode, setDemoCode] = useState('');
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetOtpStep(nextMode?: AuthMode) {
    if (nextMode) setMode(nextMode);
    setChallengeId('');
    setOtpCode('');
    setDemoCode('');
    setStatusMessage(null);
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          phone: phone.trim(),
          password,
          displayName: displayName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: 'error', text: data.error || 'Không gửi được mã xác minh.' });
        return;
      }
      setChallengeId(data.challengeId);
      setDemoCode(data.demoCode || '');
      setStatusMessage({
        type: 'info',
        text: data.message || 'Đã tạo mã OTP xác minh. Ông/Bà nhập mã bên dưới để vào SafeAI.',
      });
    } catch {
      setStatusMessage({ type: 'error', text: 'Không kết nối được máy chủ xác thực.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting || !challengeId) return;
    setStatusMessage(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId, code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: 'error', text: data.error || 'Mã OTP chưa đúng.' });
        return;
      }
      onAuthenticated(data.user as UserAccount, data.token as string);
    } catch {
      setStatusMessage({ type: 'error', text: 'Lỗi xác minh OTP.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuickDemoLogin() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/auth/quick-demo', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setStatusMessage({ type: 'error', text: 'Không vào nhanh được lúc này.' });
        return;
      }
      onAuthenticated(data.user as UserAccount, data.token as string);
    } catch {
      setStatusMessage({ type: 'error', text: 'Chưa kết nối được máy chủ.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F7FB] px-3 py-4 sm:px-6 sm:py-8 lg:flex lg:items-center lg:justify-center lg:py-12">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm lg:grid-cols-12">
        {/* Left Protective Showcase Panel */}
        <div className="flex flex-col justify-between bg-[#0F294A] p-6 text-white sm:p-8 lg:col-span-5 lg:p-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600/30 text-blue-200 ring-1 ring-blue-400/30 sm:h-12 sm:w-12">
                <ShieldCheck className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
              </div>
              <span className="text-2xl font-bold tracking-tight">SafeAI</span>
            </div>

            <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:mt-6 sm:text-3xl lg:mt-8">
              Trợ lý bảo vệ Ông/Bà tránh lừa đảo qua điện thoại
            </h1>
            <p className="mt-2.5 text-base leading-relaxed text-slate-300">
              Dễ dùng chỉ với 1 chạm: kiểm tra ảnh chụp tin nhắn, mã QR chuyển tiền và hỏi đáp bằng giọng nói tiếng Việt.
            </p>
          </div>

          <ul className="mt-6 hidden space-y-3.5 border-t border-white/15 pt-6 text-sm text-slate-200 sm:block lg:mt-8">
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>Báo màu Đỏ / Cam / Xanh rõ ràng kèm đọc to bằng tiếng Việt</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>Hỏi con cháu chỉ với 1 bấm khi có tin nhắn đáng ngờ</span>
            </li>
            <li className="flex items-start gap-2.5">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>Cảnh báo ngay khi có cuộc gọi giả danh công an, ngân hàng</span>
            </li>
          </ul>
        </div>

        {/* Right Entry Panel: 1-Tap First for Seniors */}
        <div className="p-6 sm:p-10 lg:col-span-7">
          <div className="mx-auto max-w-md">
            <h2 className="text-2xl font-bold text-slate-900">Bắt đầu sử dụng SafeAI</h2>
            <p className="mt-1.5 text-base text-slate-600">
              Ông/Bà chỉ cần bấm nút xanh bên dưới để vào dùng ngay, không cần nhớ mật khẩu.
            </p>

            {/* Primary 1-Tap Senior Entry */}
            <div className="mt-6 space-y-3">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleQuickDemoLogin()}
                className="inline-flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl bg-blue-700 px-5 text-lg font-bold text-white shadow-xs transition-colors hover:bg-blue-800 disabled:opacity-60"
              >
                {isSubmitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : (
                  <UserCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
                )}
                <span>Vào nhanh tài khoản mẫu (Bác Minh)</span>
              </button>

              <button
                type="button"
                onClick={onContinueAsGuest}
                className="inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl border-2 border-slate-300 bg-white px-5 text-base font-bold text-slate-900 transition-colors hover:bg-slate-50"
              >
                Dùng thử ngay không cần đăng nhập
              </button>
            </div>

            {statusMessage && !showPhoneAuth && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-800"
              >
                {statusMessage.text}
              </p>
            )}

            {/* Optional Phone + Password Auth Toggle */}
            <div className="mt-6 border-t border-slate-200 pt-5">
              <button
                type="button"
                aria-expanded={showPhoneAuth}
                onClick={() => setShowPhoneAuth((v) => !v)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                <span>Hoặc đăng nhập / tạo tài khoản bằng số điện thoại</span>
                <span className="text-blue-700">{showPhoneAuth ? 'Thu gọn' : 'Mở ra'}</span>
              </button>

              {showPhoneAuth && (
                <div className="mt-4">
                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
                    {[
                      { id: 'login', label: 'Đăng nhập' },
                      { id: 'register', label: 'Tạo mới' },
                      { id: 'reset', label: 'Quên mật khẩu' },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => resetOtpStep(tab.id as AuthMode)}
                        className={`min-h-[42px] whitespace-nowrap rounded-lg px-1 text-xs font-semibold transition-colors sm:px-2 sm:text-sm ${
                          mode === tab.id
                            ? 'bg-white text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {!challengeId ? (
                    <form onSubmit={handleRequestOtp} className="mt-4 space-y-3.5">
                      {mode === 'register' && (
                        <div>
                          <label htmlFor="auth-name" className="block text-sm font-semibold text-slate-700">
                            Tên gọi hiển thị (ví dụ: Bác Minh, Cô Lan)
                          </label>
                          <div className="relative mt-1.5">
                            <User className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
                            <input
                              id="auth-name"
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder="Bác Minh"
                              className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white pr-4 pl-11 text-base text-slate-900"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label htmlFor="auth-phone" className="block text-sm font-semibold text-slate-700">
                          Số điện thoại
                        </label>
                        <div className="relative mt-1.5">
                          <Phone className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
                          <input
                            id="auth-phone"
                            type="tel"
                            inputMode="tel"
                            required
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="0912345678"
                            className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white pr-4 pl-11 text-base tabular-nums text-slate-900"
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="auth-password" className="block text-sm font-semibold text-slate-700">
                          {mode === 'reset' ? 'Mật khẩu mới (8–128 ký tự)' : 'Mật khẩu'}
                        </label>
                        <div className="relative mt-1.5">
                          <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
                          <input
                            id="auth-password"
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Tối thiểu 8 ký tự"
                            className="min-h-[48px] w-full rounded-xl border border-slate-300 bg-white pr-4 pl-11 text-base text-slate-900"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-base font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                            <span>Đang kiểm tra...</span>
                          </>
                        ) : (
                          <span>
                            {mode === 'login'
                              ? 'Tiếp tục nhận mã OTP'
                              : mode === 'register'
                                ? 'Đăng ký & nhận mã OTP'
                                : 'Gửi mã OTP đặt lại mật khẩu'}
                          </span>
                        )}
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="mt-4 space-y-3.5">
                      <div>
                        <label htmlFor="auth-otp" className="block text-sm font-semibold text-slate-700">
                          Mã OTP 6 chữ số
                        </label>
                        <div className="relative mt-1.5">
                          <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2 text-slate-400" />
                          <input
                            id="auth-otp"
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            required
                            maxLength={8}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            placeholder="Nhập 6 chữ số"
                            className="min-h-[50px] w-full rounded-xl border border-slate-300 bg-white pr-4 pl-11 font-mono text-lg font-bold tracking-widest text-slate-900"
                          />
                        </div>
                      </div>

                      {demoCode && (
                        <button
                          type="button"
                          onClick={() => setOtpCode(demoCode)}
                          className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100"
                        >
                          <Copy className="h-4 w-4" aria-hidden="true" />
                          <span className="tabular-nums">Điền nhanh mã thử nghiệm ({demoCode})</span>
                        </button>
                      )}

                      <div className="flex gap-2.5">
                        <button
                          type="button"
                          onClick={() => resetOtpStep()}
                          className="min-h-[48px] rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Quay lại
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-blue-700 px-5 text-base font-bold text-white hover:bg-blue-800 disabled:opacity-60"
                        >
                          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                          <span>Xác nhận vào SafeAI</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {statusMessage && (
                    <p
                      role="status"
                      className={`mt-4 rounded-xl border px-3.5 py-2.5 text-sm font-semibold ${
                        statusMessage.type === 'error'
                          ? 'border-red-200 bg-red-50 text-red-800'
                          : 'border-blue-200 bg-blue-50 text-blue-900'
                      }`}
                    >
                      {statusMessage.text}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
