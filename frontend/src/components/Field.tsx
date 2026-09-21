interface Props {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}

export default function Field({ label, required, children }: Props) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-[#17202A] placeholder-slate-400 outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-3 focus:ring-blue-100 read-only:bg-slate-100 read-only:text-slate-500 read-only:cursor-default " +
        (props.className ?? "")
      }
    />
  );
}


export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-[#17202A] outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-3 focus:ring-blue-100 " +
        (props.className ?? "")
      }
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      rows={props.rows || 3}
      className={
        "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-sm text-[#17202A] placeholder-slate-400 outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-3 focus:ring-blue-100 " +
        (props.className ?? "")
      }
    />
  );
}

