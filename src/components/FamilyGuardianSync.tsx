import { useState } from 'react';
import {
  BellRing,
  Check,
  Copy,
  Link2,
  LogOut,
  ShieldAlert,
  Users,
} from 'lucide-react';
import type { FamilyAlertEvent, FamilySyncRole } from '../types/safeai';

interface FamilyGuardianSyncProps {
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

export function FamilyGuardianSync({
  status,
  roomCode,
  role,
  memberName,
  parentCount,
  childCount,
  alerts,
  syncError,
  onCreateRoom,
  onJoinRoom,
  onLeaveRoom,
  onAcknowledgeAlert,
  onSendTestAlert,
}: FamilyGuardianSyncProps) {
  const [selectedRole, setSelectedRole] = useState<FamilySyncRole>(role);
  const [nameInput, setNameInput] = useState<string>(memberName);
  const [codeInput, setCodeInput] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState(false);

  const isConnected = status === 'connected' && Boolean(roomCode);

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Users className="mt-1 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
          <h2 className="text-xl font-bold leading-snug text-slate-900">
            Cảnh báo Gia đình Thời gian thực
          </h2>
        </div>
        {isConnected && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
            <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />
            Đã kết nối · {parentCount} Bố/Mẹ · {childCount} Con/Cháu
          </span>
        )}
      </div>

      <p className="mt-1 text-base text-slate-600">
        Kết nối máy của Bố/Mẹ với máy Con/Cháu bằng mã 6 số. Khi máy Bố/Mẹ gặp Cảnh báo Đỏ hoặc bấm SOS, máy Con/Cháu sẽ báo động ngay lập tức.
      </p>

      {!isConnected ? (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedRole('parent')}
              className={`min-h-[44px] rounded-xl border px-3 text-sm font-bold transition-colors ${
                selectedRole === 'parent'
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              Máy Bố / Mẹ (Cần bảo vệ)
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('child')}
              className={`min-h-[44px] rounded-xl border px-3 text-sm font-bold transition-colors ${
                selectedRole === 'child'
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              Máy Con / Cháu (Người canh giữ)
            </button>
          </div>

          <div>
            <label htmlFor="family-member-name" className="block text-sm font-semibold text-slate-700">
              Tên hiển thị trên thiết bị này
            </label>
            <input
              id="family-member-name"
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder={selectedRole === 'parent' ? 'Ví dụ: Bố Minh' : 'Ví dụ: Con trai Hùng'}
              className="mt-1 min-h-[44px] w-full rounded-xl border border-slate-300 px-3 text-base"
            />
          </div>

          <button
            type="button"
            onClick={() => onCreateRoom(selectedRole, nameInput)}
            disabled={status === 'connecting'}
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-base font-bold text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <Link2 className="h-5 w-5" aria-hidden="true" />
            <span>{status === 'connecting' ? 'Đang kết nối...' : 'Tạo mã gia đình 6 số mới'}</span>
          </button>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onJoinRoom(codeInput, selectedRole, nameInput);
            }}
            className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row"
          >
            <label htmlFor="family-join-code" className="sr-only">
              Nhập mã gia đình 6 số
            </label>
            <input
              id="family-join-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Hoặc nhập mã 6 số để tham gia..."
              className="min-h-[44px] flex-1 rounded-xl border border-slate-300 px-3 font-mono text-base tracking-widest"
            />
            <button
              type="submit"
              disabled={codeInput.length !== 6 || status === 'connecting'}
              className="min-h-[44px] rounded-xl bg-slate-900 px-5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Tham gia phòng
            </button>
          </form>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Mã gia đình đang hoạt động ({role === 'parent' ? 'Vai trò Bố/Mẹ' : 'Vai trò Con/Cháu'})
              </p>
              <p className="mt-0.5 font-mono text-3xl font-extrabold tracking-[0.2em] text-[#0F294A]">
                {roomCode}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 text-sm font-semibold text-blue-900 hover:bg-blue-100"
              >
                {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedCode ? 'Đã sao chép' : 'Sao chép mã'}</span>
              </button>
              <button
                type="button"
                onClick={onLeaveRoom}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4" />
                <span>Ngắt kết nối</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-slate-600">
              {role === 'parent'
                ? 'Mỗi khi Cụ gặp Cảnh báo Đỏ, máy Con/Cháu sẽ nhận tín hiệu ngay.'
                : 'Đang canh giữ theo thời gian thực cho máy Bố/Mẹ.'}
            </span>
            <button
              type="button"
              onClick={onSendTestAlert}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 text-xs font-bold text-orange-900 hover:bg-orange-100"
            >
              <BellRing className="h-4 w-4" aria-hidden="true" />
              <span>Gửi tín hiệu thử nghiệm</span>
            </button>
          </div>

          {alerts.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-3">
              <p className="text-sm font-bold text-slate-900">Lịch sử cảnh báo gia đình gần đây:</p>
              {alerts.slice(0, 5).map((al) => (
                <div
                  key={al.id}
                  className={`rounded-xl border p-3 text-sm ${
                    al.alertLevel === 'red'
                      ? 'border-red-300 bg-red-50 text-red-950'
                      : 'border-orange-300 bg-orange-50 text-orange-950'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 font-bold">
                      <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>
                        {al.senderName}: {al.scamType}
                      </span>
                    </span>
                    <span className="text-xs tabular-nums opacity-80">
                      {new Date(al.createdAt).toLocaleTimeString('vi-VN')}
                    </span>
                  </div>
                  <p className="mt-1">{al.summary}</p>
                  {al.acknowledgedBy && al.acknowledgedBy.length > 0 ? (
                    <p className="mt-1 text-xs font-semibold text-emerald-800">
                      Đã xác nhận hỗ trợ bởi: {al.acknowledgedBy.join(', ')}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAcknowledgeAlert(al.id)}
                      className="mt-2 min-h-[34px] rounded-lg bg-white px-3 text-xs font-bold text-slate-900 shadow-xs hover:bg-slate-100"
                    >
                      Xác nhận đã nắm thông tin
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {syncError && (
        <p className="mt-3 text-sm font-semibold text-red-700" role="alert">
          {syncError}
        </p>
      )}
    </section>
  );
}
