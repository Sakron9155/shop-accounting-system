import { useState, useEffect } from "react";
import {
  fetchReportSummary,
  fetchReportIncome,
  fetchReportExpense,
  fetchReportStock,
  ReportSummary,
  ReportIncomeResponse,
  ReportExpenseResponse,
  ReportStockResponse,
} from "../services/reports";
import { formatAmount, formatDate, todayStr, monthStartStr, yearStartStr, weekStartStr } from "../utils/format";

export default function Reports() {
  const [activeTab, setActiveTab] = useState<"summary" | "income" | "expense" | "stock">("summary");
  const [periodPreset, setPeriodPreset] = useState<string>("month");
  const [startDate, setStartDate] = useState<string>(monthStartStr());
  const [endDate, setEndDate] = useState<string>(todayStr());

  // Data states
  const [summaryData, setSummaryData] = useState<ReportSummary | null>(null);
  const [incomeData, setIncomeData] = useState<ReportIncomeResponse | null>(null);
  const [expenseData, setExpenseData] = useState<ReportExpenseResponse | null>(null);
  const [stockData, setStockData] = useState<ReportStockResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const setPreset = (preset: string) => {
    setPeriodPreset(preset);
    const today = todayStr();
    if (preset === "day") {
      setStartDate(today);
      setEndDate(today);
    } else if (preset === "week") {
      setStartDate(weekStartStr());
      setEndDate(today);
    } else if (preset === "month") {
      setStartDate(monthStartStr());
      setEndDate(today);
    } else if (preset === "year") {
      setStartDate(yearStartStr());
      setEndDate(today);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      if (activeTab === "summary") {
        const res = await fetchReportSummary(startDate, endDate);
        setSummaryData(res);
      } else if (activeTab === "income") {
        const res = await fetchReportIncome(startDate, endDate, "day");
        setIncomeData(res);
      } else if (activeTab === "expense") {
        const res = await fetchReportExpense(startDate, endDate, "day");
        setExpenseData(res);
      } else if (activeTab === "stock") {
        const res = await fetchReportStock();
        setStockData(res);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการโหลดรายงาน");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, startDate, endDate]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header & Tabs */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
        <div>
          <h2 className="text-[18px] font-bold text-[#17202A]">รายงานทางบัญชีและสถิติ</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            สรุปรายรับ ต้นทุนขาย ค่าใช้จ่าย กำไรสุทธิ และรายงานมูลค่า Stock
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
          {[
            { key: "summary", label: "📊 สรุปกำไร-ขาดทุน" },
            { key: "income", label: "💰 รายงานรายรับ" },
            { key: "expense", label: "💸 รายงานรายจ่าย" },
            { key: "stock", label: "📦 รายงาน Stock" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as any)}
              className={`rounded-lg px-3.5 py-1.5 transition cursor-pointer ${
                activeTab === t.key ? "bg-white text-blue-600 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Filter Bar (for summary, income, expense) */}
      {activeTab !== "stock" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">เลือกช่วง:</span>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 text-xs font-medium">
              {[
                { key: "day", label: "วันนี้" },
                { key: "week", label: "7 วันล่าสุด" },
                { key: "month", label: "เดือนนี้" },
                { key: "year", label: "ปีนี้" },
                { key: "custom", label: "กำหนดเอง" },
              ].map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPreset(p.key)}
                  className={`rounded px-2.5 py-1 text-xs transition ${
                    periodPreset === p.key ? "bg-blue-600 text-white font-semibold" : "text-slate-600"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            />
            <span className="text-xs text-slate-400">ถึง</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPeriodPreset("custom");
              }}
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-2xl bg-white border border-[#E2E8F0]">
          <div className="flex items-center gap-3 text-slate-500 text-sm">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            กำลังคำนวณรายงานจากฐานข้อมูล...
          </div>
        </div>
      ) : (
        <>
          {/* 1. Profit & Loss Summary Tab */}
          {activeTab === "summary" && summaryData && (
            <div className="space-y-6">
              {/* Financial Statements Card */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
                <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
                  <h3 className="font-bold text-[#17202A] text-[16px]">
                    📑 งบกำไร-ขาดทุน (Income Statement)
                  </h3>
                  <p className="text-xs text-slate-500">
                    คำนวณตามหลักบัญชีร้านค้า: รายรับ - ต้นทุนขาย - ค่าใช้จ่ายดำเนินงาน = กำไรสุทธิ
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  {/* รายรับ */}
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <div>
                      <div className="font-bold text-slate-800">1. รายรับรวม / ยอดขาย (Total Revenue)</div>
                      <div className="text-xs text-slate-400">จำนวน {summaryData.income.count} รายการ</div>
                    </div>
                    <div className="text-lg font-bold text-[#16A34A]">
                      +{formatAmount(summaryData.income.total)} บ.
                    </div>
                  </div>

                  {/* ต้นทุนขาย */}
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 pl-4">
                    <div>
                      <div className="font-medium text-slate-700">หัก: ต้นทุนขาย (Cost of Goods Sold - COGS)</div>
                      <div className="text-xs text-slate-400">คำนวณจาก Stock สินค้าที่ตัดขาย</div>
                    </div>
                    <div className="text-base font-semibold text-amber-700">
                      -{formatAmount(summaryData.income.cogs)} บ.
                    </div>
                  </div>

                  {/* กำไรขั้นต้น */}
                  <div className="flex items-center justify-between py-3 bg-blue-50/50 px-4 rounded-xl border border-blue-100">
                    <div>
                      <div className="font-bold text-blue-900">กำไรขั้นต้น (Gross Profit)</div>
                      <div className="text-xs text-blue-700">อัตรากำไรขั้นต้น: {summaryData.profit.grossMargin}%</div>
                    </div>
                    <div className="text-lg font-bold text-blue-800">
                      {formatAmount(summaryData.profit.grossProfit)} บ.
                    </div>
                  </div>

                  {/* ค่าใช้จ่ายดำเนินงาน */}
                  <div className="flex items-center justify-between py-2 border-b border-slate-100 pl-4">
                    <div>
                      <div className="font-medium text-slate-700">หัก: ค่าใช้จ่ายดำเนินงาน (Operating Expenses)</div>
                      <div className="text-xs text-slate-400">ค่าเช่า, ค่าไฟ, ค่าน้ำ, ค่าแรง ฯลฯ</div>
                    </div>
                    <div className="text-base font-semibold text-[#EF4444]">
                      -{formatAmount(summaryData.expense.operating)} บ.
                    </div>
                  </div>

                  {/* กำไรจากการดำเนินงาน */}
                  <div className="flex items-center justify-between py-3 bg-slate-50 px-4 rounded-xl border border-slate-200">
                    <div>
                      <div className="font-bold text-slate-800">กำไรจากการขาย (Operating Profit)</div>
                      <div className="text-xs text-slate-500">กำไรก่อนหักค่าอุปกรณ์และอื่นๆ</div>
                    </div>
                    <div className="text-lg font-bold text-slate-800">
                      {formatAmount(summaryData.profit.operatingProfit)} บ.
                    </div>
                  </div>

                  {/* ค่าอุปกรณ์และอื่นๆ */}
                  {(summaryData.expense.equipment > 0 || summaryData.expense.other > 0) && (
                    <div className="flex items-center justify-between py-2 border-b border-slate-100 pl-4">
                      <div>
                        <div className="font-medium text-slate-700">หัก: ค่าอุปกรณ์และค่าใช้จ่ายอื่นๆ</div>
                        <div className="text-xs text-slate-400">อุปกรณ์ {formatAmount(summaryData.expense.equipment)} บ.</div>
                      </div>
                      <div className="text-base font-semibold text-[#EF4444]">
                        -{formatAmount(summaryData.expense.equipment + summaryData.expense.other)} บ.
                      </div>
                    </div>
                  )}

                  {/* กำไรสุทธิ */}
                  <div className="flex items-center justify-between py-4 bg-[#EFF6FF] px-6 rounded-2xl border-2 border-blue-300 shadow-xs">
                    <div>
                      <div className="text-base font-extrabold text-blue-950">กำไรสุทธิ (Net Profit)</div>
                      <div className="text-xs font-semibold text-[#2563EB] mt-0.5">
                        อัตรากำไรสุทธิ: {summaryData.profit.netMargin}%
                      </div>
                    </div>
                    <div className={`text-2xl font-black ${
                      summaryData.profit.netProfit >= 0 ? "text-[#2563EB]" : "text-[#EF4444]"
                    }`}>
                      {formatAmount(summaryData.profit.netProfit)} บาท
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Income Report Tab */}
          {activeTab === "income" && incomeData && (
            <div className="space-y-6">
              {/* Channel Breakdown */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
                <h3 className="font-bold text-[#17202A] text-sm mb-4">
                  💳 สัดส่วนรายรับแยกตามช่องทาง
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {incomeData.byChannel.map((c, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <div className="text-xs text-slate-500 font-medium">{c.channel || "อื่นๆ"}</div>
                      <div className="text-base font-bold text-[#16A34A] mt-1">+{formatAmount(Number(c.total))} บ.</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Time Series Table */}
              <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-600">
                      <th className="py-3 px-5">วันที่</th>
                      <th className="py-3 px-4 text-center">จำนวนรายการ</th>
                      <th className="py-3 px-4 text-right">ต้นทุนขาย</th>
                      <th className="py-3 px-5 text-right">รายรับรวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {incomeData.items.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-slate-400 text-sm">ไม่มีข้อมูลรายรับในช่วงเวลานี้</td>
                      </tr>
                    ) : (
                      incomeData.items.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-3 px-5 font-semibold text-slate-800">{formatDate(row.period)}</td>
                          <td className="py-3 px-4 text-center text-slate-500">{row.count}</td>
                          <td className="py-3 px-4 text-right text-amber-700 font-medium">{formatAmount(Number(row.cogs))} บ.</td>
                          <td className="py-3 px-5 text-right font-bold text-[#16A34A]">+{formatAmount(Number(row.total))} บ.</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. Expense Report Tab */}
          {activeTab === "expense" && expenseData && (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-600">
                    <th className="py-3 px-5">วันที่</th>
                    <th className="py-3 px-4">หมวดหมู่</th>
                    <th className="py-3 px-4">ประเภทบัญชี</th>
                    <th className="py-3 px-4 text-center">จำนวนรายการ</th>
                    <th className="py-3 px-5 text-right">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {expenseData.items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">ไม่มีข้อมูลรายจ่ายในช่วงเวลานี้</td>
                    </tr>
                  ) : (
                    expenseData.items.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-3 px-5 font-semibold text-slate-800">{formatDate(row.period)}</td>
                        <td className="py-3 px-4 text-slate-700">{row.category_name || "อื่นๆ"}</td>
                        <td className="py-3 px-4 text-xs">
                          {row.category_type === "cost_of_goods" && (
                            <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 font-medium">ซื้อสินค้าเข้าสต็อก</span>
                          )}
                          {row.category_type === "operating" && (
                            <span className="rounded bg-blue-100 text-blue-800 px-2 py-0.5 font-medium">ค่าใช้จ่ายดำเนินงาน</span>
                          )}
                          {row.category_type === "equipment" && (
                            <span className="rounded bg-purple-100 text-purple-800 px-2 py-0.5 font-medium">อุปกรณ์</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center text-slate-500">{row.count}</td>
                        <td className="py-3 px-5 text-right font-bold text-[#EF4444]">-{formatAmount(Number(row.total))} บ.</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* 4. Stock Report Tab */}
          {activeTab === "stock" && stockData && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 flex items-center justify-between shadow-xs">
                <div>
                  <div className="text-xs font-semibold text-blue-900">มูลค่า Stock สินค้าคงเหลือรวมทั้งหมด</div>
                  <div className="text-2xl font-black text-[#2563EB] mt-1">{formatAmount(stockData.totalStockValue)} บาท</div>
                </div>
                <span className="text-3xl">📦</span>
              </div>

              <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-600">
                      <th className="py-3 px-5">รหัส</th>
                      <th className="py-3 px-4">ชื่อสินค้า</th>
                      <th className="py-3 px-4 text-right">ยอดซื้อสะสม</th>
                      <th className="py-3 px-4 text-right">ยอดขายสะสม</th>
                      <th className="py-3 px-4 text-right">คงเหลือ</th>
                      <th className="py-3 px-4 text-right">ราคาทุน/หน่วย</th>
                      <th className="py-3 px-5 text-right">มูลค่าคงเหลือ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {stockData.items.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 text-sm">ยังไม่มีสินค้าในระบบ</td>
                      </tr>
                    ) : (
                      stockData.items.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-3 px-5 font-mono text-xs text-slate-500 font-semibold">{p.code}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900">{p.name}</td>
                          <td className="py-3 px-4 text-right text-emerald-600 font-medium">+{p.total_purchased} {p.unit}</td>
                          <td className="py-3 px-4 text-right text-rose-600 font-medium">-{p.total_sold} {p.unit}</td>
                          <td className="py-3 px-4 text-right font-bold text-slate-800">{p.quantity} {p.unit}</td>
                          <td className="py-3 px-4 text-right text-slate-600">{formatAmount(Number(p.cost_price))} บ.</td>
                          <td className="py-3 px-5 text-right font-bold text-blue-700">{formatAmount(Number(p.stock_value))} บ.</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
