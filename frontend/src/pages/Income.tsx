import { useState, useEffect } from "react";
import {
  fetchIncomeList,
  fetchIncomeDailySummary,
  createIncome,
  updateIncome,
  deleteIncome,
  fetchIncomeById,
  Income as IncomeType,
  DailySummaryRow,
} from "../services/income";
import { fetchSettings, PaymentMethod } from "../services/settings";
import { fetchProducts, Product } from "../services/products";
import { formatAmount, formatDate, todayStr, monthStartStr } from "../utils/format";
import Modal from "../components/Modal";
import Field, { Input, Select, Textarea } from "../components/Field";

export default function Income() {
  const [viewMode, setViewMode] = useState<"list" | "daily">("list");
  const [incomes, setIncomes] = useState<IncomeType[]>([]);
  const [totalIncome, setTotalIncome] = useState<string>("0");
  const [totalCogs, setTotalCogs] = useState<string>("0");
  const [dailySummaries, setDailySummaries] = useState<DailySummaryRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Filters
  const [startDate, setStartDate] = useState<string>(monthStartStr());
  const [endDate, setEndDate] = useState<string>(todayStr());
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalType, setModalType] = useState<"general" | "sale">("general");
  const [editItem, setEditItem] = useState<IncomeType | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Form State
  const [formDate, setFormDate] = useState<string>(todayStr());
  const [formDesc, setFormDesc] = useState<string>("");
  const [formAmount, setFormAmount] = useState<string>("");
  const [formChannelId, setFormChannelId] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");

  // Sale items state (for type=sale)
  const [saleItems, setSaleItems] = useState<{ product_id: number; quantity: number; unit_price: number }[]>([]);

  // Detail Modal
  const [detailItem, setDetailItem] = useState<IncomeType | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [incomeRes, settingsRes, prodRes] = await Promise.all([
        fetchIncomeList({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          paymentMethodId: selectedChannel ? Number(selectedChannel) : undefined,
          search: search || undefined,
        }),
        fetchSettings(),
        fetchProducts(),
      ]);

      setIncomes(incomeRes.items);
      setTotalIncome(incomeRes.total);
      setTotalCogs(incomeRes.totalCogs);
      setPaymentMethods(settingsRes.paymentMethods || []);
      setProducts(prodRes.items || []);

      if (viewMode === "daily") {
        const dailyRes = await fetchIncomeDailySummary(startDate, endDate);
        setDailySummaries(dailyRes.summary);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลรายรับ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, selectedChannel, viewMode]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const openAddGeneral = () => {
    setEditItem(null);
    setModalType("general");
    setFormDate(todayStr());
    setFormDesc("");
    setFormAmount("");
    setFormChannelId(paymentMethods[0]?.id ? String(paymentMethods[0].id) : "");
    setFormNotes("");
    setShowModal(true);
  };

  const openAddSale = () => {
    setEditItem(null);
    setModalType("sale");
    setFormDate(todayStr());
    setFormDesc("ขายสินค้าหน้าร้าน");
    setFormAmount("");
    setFormChannelId(paymentMethods[0]?.id ? String(paymentMethods[0].id) : "");
    setFormNotes("");
    setSaleItems(products.length > 0 ? [{ product_id: products[0].id, quantity: 1, unit_price: products[0].sell_price }] : []);
    setShowModal(true);
  };

  const openEdit = async (item: IncomeType) => {
    setEditItem(item);
    setModalType(item.type);
    setFormDate(item.date?.split("T")[0] || todayStr());
    setFormDesc(item.description);
    setFormAmount(String(item.amount));
    setFormChannelId(item.payment_method_id ? String(item.payment_method_id) : "");
    setFormNotes(item.notes || "");

    if (item.type === "sale") {
      // Load full sale details (including items) before opening modal
      try {
        const full = await fetchIncomeById(item.id);
        const loadedItems = (full.items || []).map((it) => ({
          product_id: it.product_id,
          quantity: it.quantity,
          unit_price: it.unit_price,
        }));
        setSaleItems(loadedItems);
        // Recalculate amount from loaded items
        const total = loadedItems.reduce(
          (sum, si) => sum + si.quantity * si.unit_price,
          0,
        );
        setFormAmount(total.toFixed(2));
      } catch (err: any) {
        alert("ไม่สามารถโหลดรายการสินค้าเดิมได้: " + err.message);
        return;
      }
    } else {
      setSaleItems([]);
    }

    setShowModal(true);
  };

  const viewDetail = async (id: number) => {
    try {
      const full = await fetchIncomeById(id);
      setDetailItem(full);
    } catch (err: any) {
      alert("ไม่สามารถดูรายละเอียดได้: " + err.message);
    }
  };

  const updateSaleItem = (index: number, field: string, value: any) => {
    const next = [...saleItems];
    if (field === "product_id") {
      const pid = Number(value);
      const p = products.find((x) => x.id === pid);
      next[index].product_id = pid;
      if (p) next[index].unit_price = p.sell_price;
    } else if (field === "quantity") {
      next[index].quantity = Math.max(1, parseInt(value) || 1);
    } else if (field === "unit_price") {
      next[index].unit_price = Math.max(0, parseFloat(value) || 0);
    }
    setSaleItems(next);

    // Recalculate total amount
    const total = next.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    setFormAmount(total.toFixed(2));
  };

  const addSaleItemRow = () => {
    if (products.length === 0) return;
    setSaleItems([...saleItems, { product_id: products[0].id, quantity: 1, unit_price: products[0].sell_price }]);
  };

  const removeSaleItemRow = (index: number) => {
    const next = saleItems.filter((_, i) => i !== index);
    setSaleItems(next);
    const total = next.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    setFormAmount(total.toFixed(2));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc.trim() || !formAmount || Number(formAmount) < 0) {
      alert("กรุณากรอกข้อมูลให้ครบถ้วน");
      return;
    }

    // Validate sale items
    if (modalType === "sale") {
      if (saleItems.length === 0) {
        alert("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
        return;
      }
      for (const si of saleItems) {
        if (!si.product_id || si.quantity <= 0) {
          alert("กรุณากรอกสินค้าและจำนวนให้ครบถ้วน");
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      if (editItem) {
        if (editItem.type === "sale") {
          // Edit sale — send items so backend can reverse + reapply stock
          await updateIncome(editItem.id, {
            date: formDate,
            description: formDesc.trim(),
            amount: Number(formAmount),
            payment_method_id: formChannelId ? Number(formChannelId) : null,
            notes: formNotes,
            items: saleItems,
          });
        } else {
          // Edit general income — no items
          await updateIncome(editItem.id, {
            date: formDate,
            description: formDesc.trim(),
            amount: Number(formAmount),
            payment_method_id: formChannelId ? Number(formChannelId) : null,
            notes: formNotes,
          });
        }
      } else {
        // Create new income
        await createIncome({
          date: formDate,
          description: formDesc.trim(),
          amount: Number(formAmount),
          payment_method_id: formChannelId ? Number(formChannelId) : null,
          type: modalType,
          notes: formNotes,
          items: modalType === "sale" ? saleItems : undefined,
        });
      }
      setShowModal(false);
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? หากเป็นรายการขาย สินค้าจะถูกคืนเข้า Stock อัตโนมัติ")) return;
    try {
      await deleteIncome(id);
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
        <div>
          <h2 className="text-[18px] font-bold text-[#17202A]">รายการรายรับ</h2>
          <p className="text-xs text-slate-500 mt-0.5">บันทึกรายรับทั่วไปและการขายสินค้า (ตัด Stock อัตโนมัติ)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-lg px-3 py-1.5 transition ${viewMode === "list" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600"}`}
            >
              📋 รายการทั้งหมด
            </button>
            <button
              onClick={() => setViewMode("daily")}
              className={`rounded-lg px-3 py-1.5 transition ${viewMode === "daily" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600"}`}
            >
              📅 สรุปยอดรายวัน
            </button>
          </div>
          <button
            onClick={openAddGeneral}
            className="rounded-xl border border-blue-600 bg-white px-4 py-2 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 transition cursor-pointer"
          >
            + รายรับทั่วไป
          </button>
          <button
            onClick={openAddSale}
            className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition cursor-pointer"
          >
            + ขายสินค้า (ตัด Stock)
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-1 flex-wrap items-center gap-3 min-w-[300px]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">ตั้งแต่วันที่:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            />
            <span className="text-xs font-semibold text-slate-600">ถึง:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">ช่องทาง:</span>
            <select
              value={selectedChannel}
              onChange={(e) => setSelectedChannel(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            >
              <option value="">ทุกช่องทาง</option>
              {paymentMethods.map((pm) => (
                <option key={pm.id} value={pm.id}>
                  {pm.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <input
              type="text"
              placeholder="ค้นหารายการ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900"
            >
              ค้นหา
            </button>
          </div>
        </form>

        <div className="flex items-center gap-4 text-xs font-semibold bg-blue-50/70 border border-blue-100 rounded-xl px-4 py-2">
          <div>
            <span className="text-slate-500 mr-1">รวมรายรับ:</span>
            <span className="text-[#16A34A] text-sm font-bold">+{formatAmount(Number(totalIncome))} บ.</span>
          </div>
          <div className="border-l border-blue-200 pl-4">
            <span className="text-slate-500 mr-1">ต้นทุนขาย:</span>
            <span className="text-amber-700 text-sm font-bold">{formatAmount(Number(totalCogs))} บ.</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Main Content Table / Daily Summary */}
      {viewMode === "list" ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-600">
                  <th className="py-3.5 px-5">วันที่</th>
                  <th className="py-3.5 px-4">รายการ</th>
                  <th className="py-3.5 px-4">ประเภท</th>
                  <th className="py-3.5 px-4">ช่องทาง</th>
                  <th className="py-3.5 px-4 text-right">จำนวนเงิน</th>
                  <th className="py-3.5 px-4 text-right">ต้นทุนขาย</th>
                  <th className="py-3.5 px-5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : incomes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      ไม่มีรายการรายรับในช่วงเวลานี้
                    </td>
                  </tr>
                ) : (
                  incomes.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-5 text-slate-600 font-medium whitespace-nowrap">{formatDate(item.date)}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {item.description}
                        {item.notes && <div className="text-xs font-normal text-slate-400">{item.notes}</div>}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.type === "sale" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            📦 ขายสินค้า
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            💵 รายรับทั่วไป
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                        {item.payment_method_name ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                            {item.payment_method_name}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-[#16A34A] whitespace-nowrap">
                        +{formatAmount(item.amount)} บ.
                      </td>
                      <td className="py-3.5 px-4 text-right text-slate-500 whitespace-nowrap">
                        {item.cost_of_goods > 0 ? `${formatAmount(item.cost_of_goods)} บ.` : "-"}
                      </td>
                      <td className="py-3.5 px-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {item.type === "sale" && (
                            <button
                              onClick={() => viewDetail(item.id)}
                              className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
                            >
                              ดูสินค้า
                            </button>
                          )}
                          <button
                            onClick={() => openEdit(item)}
                            className="text-xs text-slate-600 hover:text-blue-600 font-medium cursor-pointer"
                          >
                            แก้ไข
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="text-xs text-red-600 hover:underline font-medium ml-1 cursor-pointer"
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Daily Summary View (Requirement 8) */
        <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
            <h3 className="text-sm font-bold text-slate-800">
              📊 สรุปยอดรวมรายวันแยกตามช่องทางรับเงิน
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-[13px] font-semibold text-slate-600 bg-slate-50/50">
                  <th className="py-3.5 px-5">วันที่</th>
                  {paymentMethods.map((pm) => (
                    <th key={pm.id} className="py-3.5 px-4 text-right">
                      {pm.name}
                    </th>
                  ))}
                  <th className="py-3.5 px-5 text-right font-bold text-slate-900 bg-blue-50/40">
                    ยอดรวมทั้งหมด
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {dailySummaries.length === 0 ? (
                  <tr>
                    <td colSpan={paymentMethods.length + 2} className="py-12 text-center text-slate-400">
                      ไม่มีข้อมูลสรุปรายวันในช่วงเวลานี้
                    </td>
                  </tr>
                ) : (
                  dailySummaries.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-5 font-semibold text-slate-800 whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>
                      {paymentMethods.map((pm) => {
                        const val = row.channels[pm.name] || 0;
                        return (
                          <td key={pm.id} className="py-3.5 px-4 text-right text-slate-600 whitespace-nowrap">
                            {val > 0 ? `${formatAmount(val)}` : "-"}
                          </td>
                        );
                      })}
                      <td className="py-3.5 px-5 text-right font-bold text-[#16A34A] bg-blue-50/40 whitespace-nowrap">
                        +{formatAmount(row.total)} บ.
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Income Modal */}
      {showModal && (
        <Modal
          title={
            editItem
              ? editItem.type === "sale"
                ? "แก้ไขรายการขายสินค้า (ปรับ Stock อัตโนมัติ)"
                : "แก้ไขรายรับทั่วไป"
              : modalType === "sale"
              ? "ขายสินค้าหน้าร้าน (ตัด Stock)"
              : "เพิ่มรายรับทั่วไป"
          }
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          loading={submitting}
          maxWidth={modalType === "sale" ? "max-w-2xl" : "max-w-lg"}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="วันที่" required>
              <Input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
              />
            </Field>

            <Field label="ช่องทางรับเงิน" required>
              <Select
                value={formChannelId}
                onChange={(e) => setFormChannelId(e.target.value)}
                required
              >
                <option value="">-- เลือกช่องทาง --</option>
                {paymentMethods.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="รายการ / คำอธิบาย" required>
            <Input
              placeholder="เช่น ขายของหน้าร้าน, ค่าบริการ"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              required
            />
          </Field>

          {/* If Sale Type: Product Item Selector (for both Create and Edit sale) */}
          {modalType === "sale" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  📦 รายการสินค้าที่ขาย
                </span>
                <button
                  type="button"
                  onClick={addSaleItemRow}
                  className="text-xs font-semibold text-[#2563EB] hover:underline"
                >
                  + เพิ่มรายการสินค้า
                </button>
              </div>

              {saleItems.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">
                  ยังไม่มีสินค้าในรายการ กรุณากดเพิ่มสินค้า
                </div>
              ) : (
                saleItems.map((item, index) => {
                  const p = products.find((x) => x.id === item.product_id);
                  return (
                    <div key={index} className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-lg border border-slate-200">
                      <div className="flex-1 min-w-[140px]">
                        <label className="text-[10px] text-slate-400 block">สินค้า (คงเหลือ)</label>
                        <select
                          value={item.product_id}
                          onChange={(e) => updateSaleItem(index, "product_id", e.target.value)}
                          className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded p-1.5"
                        >
                          {products.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name} (เหลือ {prod.quantity} {prod.unit})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-20">
                        <label className="text-[10px] text-slate-400 block">จำนวน</label>
                        <input
                          type="number"
                          min="1"
                          max={p?.quantity || 999}
                          value={item.quantity}
                          onChange={(e) => updateSaleItem(index, "quantity", e.target.value)}
                          className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded p-1.5 text-right"
                          required
                        />
                      </div>

                      <div className="w-24">
                        <label className="text-[10px] text-slate-400 block">ราคา/หน่วย</label>
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateSaleItem(index, "unit_price", e.target.value)}
                          className="w-full text-xs font-medium text-slate-800 bg-slate-50 border border-slate-200 rounded p-1.5 text-right"
                          required
                        />
                      </div>

                      <div className="w-24 text-right">
                        <label className="text-[10px] text-slate-400 block">รวม</label>
                        <div className="text-xs font-bold text-slate-800 pt-1.5">
                          {formatAmount(item.quantity * item.unit_price)} บ.
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeSaleItemRow(index)}
                        className="text-red-500 hover:text-red-700 text-sm p-1 mt-3"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          <Field label={modalType === "sale" ? "จำนวนเงินรวม (บาท) — คำนวณอัตโนมัติจากสินค้า" : "จำนวนเงินรวม (บาท)"} required>
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              required
              readOnly={modalType === "sale"}
            />
          </Field>

          <Field label="หมายเหตุ (ถ้ามี)">
            <Textarea
              placeholder="รายละเอียดเพิ่มเติม..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
            />
          </Field>
        </Modal>
      )}

      {/* Sale Detail Modal */}
      {detailItem && (
        <Modal
          title="รายละเอียดการขายสินค้า"
          onClose={() => setDetailItem(null)}
          onSubmit={(e) => {
            e.preventDefault();
            setDetailItem(null);
          }}
          submitLabel="ปิด"
        >
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-xl text-xs">
              <div>
                <span className="text-slate-400">วันที่:</span>
                <span className="font-semibold text-slate-800 ml-2">{formatDate(detailItem.date)}</span>
              </div>
              <div>
                <span className="text-slate-400">ช่องทาง:</span>
                <span className="font-semibold text-slate-800 ml-2">{detailItem.payment_method_name || "-"}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">รายการ:</span>
                <span className="font-semibold text-slate-800 ml-2">{detailItem.description}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                📦 สินค้าที่ขายและต้นทุน
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 text-slate-600 font-semibold">
                    <tr>
                      <th className="py-2.5 px-3 text-left">สินค้า</th>
                      <th className="py-2.5 px-2 text-right">จำนวน</th>
                      <th className="py-2.5 px-2 text-right">ราคาขาย</th>
                      <th className="py-2.5 px-2 text-right">ต้นทุน/หน่วย</th>
                      <th className="py-2.5 px-3 text-right">ยอดรวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {detailItem.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5 px-3 font-medium text-slate-800">{item.product_name}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600">{item.quantity} {item.unit}</td>
                        <td className="py-2.5 px-2 text-right text-slate-600">{formatAmount(item.unit_price)}</td>
                        <td className="py-2.5 px-2 text-right text-amber-700 font-medium">{formatAmount(item.cost_price)}</td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-900">{formatAmount(item.subtotal)} บ.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between items-center bg-blue-50 p-4 rounded-xl text-sm font-semibold">
              <div>
                <div className="text-xs text-slate-500">ต้นทุนขายรวม (COGS)</div>
                <div className="text-amber-800 font-bold">{formatAmount(detailItem.cost_of_goods)} บาท</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">ยอดเงินรับสุทธิ</div>
                <div className="text-[#16A34A] text-base font-bold">+{formatAmount(detailItem.amount)} บาท</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
