import { ReactNode, useState } from "react";

export type Page = "dashboard" | "income" | "expense" | "stock" | "reports" | "settings";

interface Props {
  page: Page;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
  shopName: string;
  children: ReactNode;
  headerRight?: ReactNode;
  title: string;
}

const navItems: { key: Page; label: string; icon: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: "📊" },
  { key: "income", label: "รายรับ", icon: "💰" },
  { key: "expense", label: "รายจ่าย", icon: "💸" },
  { key: "stock", label: "Stock", icon: "📦" },
  { key: "reports", label: "รายงาน", icon: "📈" },
  { key: "settings", label: "ตั้งค่า", icon: "⚙️" },
];

export default function Layout({ page, onNavigate, onLogout, shopName, children, headerRight, title }: Props) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigate = (nextPage: Page) => {
    onNavigate(nextPage);
    setMobileMenuOpen(false);
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#F8FAFC] text-[#17202A] lg:flex-row font-sans">
      {/* Mobile Backdrop */}
      <div
        className={`${mobileMenuOpen ? "opacity-100" : "pointer-events-none opacity-0"} fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity lg:hidden`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={`${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[#0F172A] text-white transition-transform duration-200 lg:static lg:w-[260px] lg:translate-x-0 lg:flex-shrink-0 shadow-xl lg:shadow-none`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-md font-bold text-lg">
              🏪
            </div>
            <div>
              <div className="text-[17px] font-bold tracking-tight text-white leading-tight">ระบบบัญชีร้านค้า</div>
              <div className="text-[12px] text-slate-400 truncate max-w-[140px]">{shopName || "ร้านค้าส่วนตัว"}</div>
            </div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1.5 px-3 py-4">
          <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            เมนูหลัก
          </div>
          {navItems.map((item) => {
            const active = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleNavigate(item.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[15px] font-medium transition-all ${
                  active
                    ? "bg-[#2563EB] text-white shadow-md font-semibold"
                    : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <span className="text-[18px]">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="border-t border-slate-800 p-4">
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-[14px] font-medium text-slate-400 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <span>🚪</span>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-[#E2E8F0] bg-white px-5 sm:px-8 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-slate-50 text-slate-700 hover:bg-slate-100 lg:hidden"
              aria-label="Toggle menu"
            >
              ☰
            </button>
            <h1 className="text-[20px] font-bold text-[#17202A]">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            {headerRight}
            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EFF6FF] text-[13px] font-bold text-[#2563EB]">
                ผ
              </div>
              <span className="hidden sm:inline text-[14px] font-medium text-slate-700">เจ้าของร้าน</span>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#F8FAFC]">
          {children}
        </main>
      </div>
    </div>
  );
}

