import { ReactNode } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  submitLabel?: string;
  loading?: boolean;
  maxWidth?: string;
}

export default function Modal({
  title,
  onClose,
  children,
  onSubmit,
  submitLabel = "บันทึก",
  loading = false,
  maxWidth = "max-w-xl",
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity" onClick={onClose} />
      <div className={`relative z-10 w-full ${maxWidth} my-6 sm:my-10 flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-100 max-h-[90vh]`}>
        {/* Header — sticky */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50 flex-shrink-0 rounded-t-2xl">
          <h2 className="text-[17px] font-bold text-[#17202A]">{title}</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {/* Scrollable content + form */}
        <form onSubmit={onSubmit} className="flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {children}
          </div>

          {/* Footer — sticky */}
          <div className="flex flex-col gap-3 px-6 py-4 border-t border-slate-100 bg-white sm:flex-row-reverse flex-shrink-0 rounded-b-2xl">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  กำลังบันทึก...
                </span>
              ) : (
                submitLabel
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50 cursor-pointer"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

