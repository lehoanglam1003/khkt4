import { BookOpen, HelpCircle, PhoneCall, SearchCheck, Settings, ShieldCheck } from 'lucide-react';
import type { UserAccount } from '../types/safeai';

export type AppTab = 'scan' | 'lookup' | 'diary';

interface TopNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  onTriggerSos: () => void;
  diaryCount: number;
  currentUser: UserAccount;
  onLogout: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string; icon: typeof ShieldCheck }[] = [
  { id: 'scan', label: 'Kiểm tra & Hỏi', icon: ShieldCheck },
  { id: 'lookup', label: 'Tra cứu', icon: SearchCheck },
  { id: 'diary', label: 'Nhật ký', icon: BookOpen },
];

export function TopNav({
  activeTab,
  onSelectTab,
  onTriggerSos,
  diaryCount,
  currentUser,
  onOpenSettings,
  onOpenGuide,
}: TopNavProps) {
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:gap-6 sm:px-6 lg:px-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('scan');
            }}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-bold tracking-tight text-[#0F294A] sm:text-xl"
          >
            <ShieldCheck className="h-6 w-6 text-blue-700" aria-hidden="true" />
            <span>SafeAI</span>
          </a>

          <nav aria-label="Điều hướng chính" className="hidden items-center gap-6 md:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`min-h-[44px] shrink-0 whitespace-nowrap border-b-2 px-1 text-base font-semibold transition-colors ${
                    isActive
                      ? 'border-blue-700 text-blue-700'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                  {item.id === 'diary' && diaryCount > 0 ? ` (${diaryCount})` : ''}
                </button>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={onOpenGuide}
              aria-label="Hướng dẫn sử dụng SafeAI"
              title="Hướng dẫn sử dụng dễ hiểu"
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-900 transition-colors hover:bg-blue-100"
            >
              <HelpCircle className="h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
              <span>Hướng dẫn</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              aria-label={`Cài đặt hiển thị và tài khoản (${currentUser.displayName})`}
              title="Cài đặt chữ đậm, giọng đọc & tài khoản"
              className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <Settings className="h-4 w-4 shrink-0 text-slate-700" aria-hidden="true" />
              <span className="hidden sm:inline">Cài đặt</span>
            </button>
            <button
              type="button"
              onClick={onTriggerSos}
              className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl bg-red-600 px-3.5 text-sm font-bold text-white transition-colors hover:bg-red-700 sm:px-4"
            >
              <PhoneCall className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>SOS</span>
              <span className="hidden sm:inline">Khẩn cấp</span>
            </button>
          </div>
        </div>
      </header>

      <nav
        aria-label="Điều hướng di động"
        className="fixed bottom-0 left-0 right-0 z-30 grid h-14 grid-cols-3 border-t border-slate-200 bg-white/95 backdrop-blur-sm md:hidden"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold ${
                isActive ? 'text-blue-700' : 'text-slate-600'
              }`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
