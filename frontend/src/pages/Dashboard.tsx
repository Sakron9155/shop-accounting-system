import { useState, useEffect } from "react";
import {
  fetchDashboardSummary,
  fetchDashboardChart,
  DashboardSummary,
  DashboardChart,
} from "../services/dashboard";
import { formatAmount, formatDate } from "../utils/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface Props {
  onNavigate?: (page: string) => void;
}

export default function Dashboard({ onNavigate }: Props) {
  const [period, setPeriod] = useState<string>("month");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [summaryData, setSummaryData] = useState<DashboardSummary | null>(null);
  const [chartData, setChartData] = useState<DashboardChart | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [sum, ch] = await Promise.all([
        fetchDashboardSummary(period, startDate, endDate),
        fetchDashboardChart(period, startDate, endDate),
      ]);
      setSummaryData(sum);
      setChartData(ch);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "ไม่สามารถโหลดข้อมูล Dashboard ได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (period !== "custom" || (startDate && endDate)) {
      loadData();
    }
  }, [period, startDate, endDate]);

  const s = summaryData?.summary;
  const stock = summaryData?.stock;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Filter Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E2E8F0] bg-white p-4 sm:px-6 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-[#17202A]">ช่วงเวลา:</span>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-medium">
            {[
              { key: "day", label: "วันนี้" },
              { key: "week", label: "7 วันล่าสุด" },
              { key: "month", label: "เดือนนี้" },
              { key: "year", label: "ปีนี้" },
              { key: "custom", label: "กำหนดเอง" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`rounded-lg px-3 py-1.5 transition-all text-[13px] ${
                  period === p.key
                    ? "bg-[#2563EB] text-white shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            />
            <span className="text-slate-400 text-xs">ถึง</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            />
            <button
              onClick={loadData}
              className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              ค้นหา
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {loading && !summaryData ? (
        <div className="flex h-64 items-center justify-center rounded-2xl bg-white border border-[#E2E8F0]">
          <div className="flex items-center gap-3 text-slate-500 text-sm">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            กำลังโหลดข้อมูลจากฐานข้อมูล...
          </div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* รายรับ */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-sm mb-2">
                <span>ยอดขาย / รายรับ</span>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  รายรับ
                </span>
              </div>
              <div className="text-[26px] font-bold text-[#16A34A] leading-tight">
                {formatAmount(s?.totalIncome ?? 0)}
              </div>
              <div className="mt-1 text-xs text-slate-400">บาท</div>
            </div>

            {/* ต้นทุนขาย */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-sm mb-2">
                <span>ต้นทุนขาย (COGS)</span>
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                  ต้นทุน
                </span>
              </div>
              <div className="text-[26px] font-bold text-slate-700 leading-tight">
                {formatAmount(s?.totalCogs ?? 0)}
              </div>
              <div className="mt-1 text-xs text-slate-400">บาท (คำนวณจาก Stock)</div>
            </div>

            {/* ค่าใช้จ่ายทั้งหมด */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-sm mb-2">
                <span>ค่าใช้จ่ายทั้งหมด</span>
                <span className="rounded-md bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700">
                  รายจ่าย
                </span>
              </div>
              <div className="text-[26px] font-bold text-[#EF4444] leading-tight">
                {formatAmount(s?.totalExpense ?? 0)}
              </div>
              <div className="mt-1 text-xs text-slate-400">
                ดำเนินงาน {formatAmount(s?.operatingExpense ?? 0)} บ.
              </div>
            </div>

            {/* กำไรสุทธิ */}
            <div className="rounded-2xl border border-blue-200 bg-[#EFF6FF] p-5 shadow-xs">
              <div className="flex items-center justify-between text-slate-600 text-sm mb-2">
                <span className="font-semibold text-blue-900">กำไรสุทธิ (Net Profit)</span>
                <span className="rounded-md bg-blue-100 px-2 py-0.5 text-xs font-bold text-[#2563EB]">
                  {s?.netProfitMargin ?? 0}%
                </span>
              </div>
              <div className={`text-[26px] font-bold leading-tight ${
                (s?.netProfit ?? 0) >= 0 ? "text-[#2563EB]" : "text-[#EF4444]"
              }`}>
                {formatAmount(s?.netProfit ?? 0)}
              </div>
              <div className="mt-1 text-xs text-blue-700 font-medium">
                กำไรขั้นต้น: {formatAmount(s?.grossProfit ?? 0)} บ.
              </div>
            </div>
          </div>

          {/* Secondary Stats Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-xs text-slate-500">กำไรจากการขาย (Operating Profit)</div>
                <div className="text-lg font-bold text-slate-800">{formatAmount(s?.operatingProfit ?? 0)} บาท</div>
              </div>
              <span className="text-2xl">💼</span>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-xs text-slate-500">มูลค่า Stock คงเหลือ</div>
                <div className="text-lg font-bold text-blue-700">{formatAmount(stock?.totalValue ?? 0)} บาท</div>
              </div>
              <span className="text-2xl">📦</span>
            </div>

            <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 flex items-center justify-between shadow-xs">
              <div>
                <div className="text-xs text-slate-500">สินค้าในระบบ / สินค้าใกล้หมด</div>
                <div className="text-lg font-bold text-slate-800">
                  {stock?.productCount ?? 0} รายการ
                  {(stock?.lowStockCount ?? 0) > 0 && (
                    <span className="ml-2 text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
                      ⚠️ ใกล้หมด {stock?.lowStockCount}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-2xl">🔔</span>
            </div>
          </div>

          {/* Chart Section */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-[17px] font-bold text-[#17202A]">แนวโน้มการเงิน (รายรับ / ต้นทุน / รายจ่าย / กำไร)</h2>
                <p className="text-xs text-slate-500 mt-0.5">เปรียบเทียบตามช่วงเวลาจริงจากฐานข้อมูล PostgreSQL</p>
              </div>
            </div>

            {chartData?.chart && chartData.chart.length > 0 ? (
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.chart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748B" }} stroke="#E2E8F0" />
                    <YAxis tick={{ fontSize: 12, fill: "#64748B" }} stroke="#E2E8F0" />
                    <Tooltip
                      formatter={(v: any) => formatAmount(Number(v)) + " บาท"}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "1px solid #E2E8F0",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        fontSize: "13px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "10px" }} />
                    <Bar dataKey="income" name="รายรับ" fill="#16A34A" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cogs" name="ต้นทุนขาย" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="รายจ่าย" fill="#EF4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="profit" name="กำไรสุทธิ" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center text-slate-400 text-sm">
                <span>📭 ยังไม่มีข้อมูลบันทึกในช่วงเวลานี้</span>
              </div>
            )}
          </div>

          {/* Recent Transactions Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Recent Income */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-600 font-bold">●</span>
                  <h3 className="font-bold text-[#17202A] text-[15px]">รายการรายรับล่าสุด</h3>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("income")}
                    className="text-xs font-semibold text-[#2563EB] hover:underline"
                  >
                    ดูทั้งหมด →
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {!chartData?.recentIncome || chartData.recentIncome.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">ไม่มีรายการรายรับล่าสุด</div>
                ) : (
                  chartData.recentIncome.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{item.description}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{formatDate(item.date)}</span>
                          {item.payment_method && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                              {item.payment_method}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-[#16A34A]">
                          +{formatAmount(item.amount)} บ.
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Expenses */}
            <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4 bg-slate-50/50">
                <div className="flex items-center gap-2">
                  <span className="text-rose-600 font-bold">●</span>
                  <h3 className="font-bold text-[#17202A] text-[15px]">รายการรายจ่ายล่าสุด</h3>
                </div>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate("expense")}
                    className="text-xs font-semibold text-[#2563EB] hover:underline"
                  >
                    ดูทั้งหมด →
                  </button>
                )}
              </div>
              <div className="divide-y divide-slate-100">
                {!chartData?.recentExpense || chartData.recentExpense.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">ไม่มีรายการรายจ่ายล่าสุด</div>
                ) : (
                  chartData.recentExpense.map((item) => (
                    <div key={item.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/70 transition">
                      <div>
                        <div className="text-sm font-medium text-slate-900">{item.description}</div>
                        <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{formatDate(item.date)}</span>
                          {item.category_name && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                              {item.category_name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-[#EF4444]">
                          -{formatAmount(item.amount)} บ.
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
