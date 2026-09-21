import { useState } from "react";

interface Props {
  onLogin: () => void;
}

export default function Login({ onLogin }: Props) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user.trim() || !pass.trim()) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }
    onLogin();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F8F5] p-6 sm:p-8">
      <div className="w-full max-w-2xl rounded-3xl border border-[#E1EAE4] bg-white p-10 shadow-sm sm:p-14 lg:p-16">
        <h1 className="mb-3 text-center text-[42px] font-bold text-[#163C4D] sm:text-[50px]">ระบบบัญชีร้านค้า</h1>
        <p className="mb-10 text-center text-xl text-[#6A7871] sm:mb-12">เข้าสู่ระบบ</p>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div>
            <label className="mb-3 block text-lg font-medium text-[#53635B]">อีเมล / ชื่อผู้ใช้</label>
            <input
              className="w-full rounded-xl bg-[#F3F7FA] px-6 py-5 text-lg text-[#17221D] placeholder-[#7E9BA7] outline-none transition focus:ring-2 focus:ring-[#4F9CC7]/40"
              placeholder="กรอกข้อมูล"
              value={user}
              onChange={(e) => setUser(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-3 block text-lg font-medium text-[#53635B]">รหัสผ่าน</label>
            <input
              type="password"
              className="w-full rounded-xl bg-[#F3F7FA] px-6 py-5 text-lg text-[#17221D] placeholder-[#7E9BA7] outline-none transition focus:ring-2 focus:ring-[#4F9CC7]/40"
              placeholder="กรอกรหัสผ่าน"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
            />
          </div>
          {error && <p className="text-lg text-[#E5484D]">{error}</p>}
          <button
            type="submit"
            className="w-full rounded-xl bg-[#4F9CC7] py-5 text-xl font-semibold text-white transition hover:bg-[#3F87AE]"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </div>
  );
}
