import { useState, useEffect } from "react";
import {
  fetchStockSummary,
  fetchStockMovements,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  Product,
  StockMovement,
} from "../services/products";
import { formatAmount, formatDate } from "../utils/format";
import Modal from "../components/Modal";
import Field, { Input } from "../components/Field";

export default function Products() {
  const [tab, setTab] = useState<"products" | "movements">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [totalStockValue, setTotalStockValue] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  // Search & Filters
  const [search, setSearch] = useState<string>("");
  const [selectedProductFilter, setSelectedProductFilter] = useState<string>("");
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Adjust Modal
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustQty, setAdjustQty] = useState<string>("");
  const [adjustNotes, setAdjustNotes] = useState<string>("");

  // Product Form
  const [formCode, setFormCode] = useState<string>("");
  const [formName, setFormName] = useState<string>("");
  const [formUnit, setFormUnit] = useState<string>("ชิ้น");
  const [formCostPrice, setFormCostPrice] = useState<string>("");
  const [formSellPrice, setFormSellPrice] = useState<string>("");
  const [formQty, setFormQty] = useState<string>("0");
  const [formLowAlert, setFormLowAlert] = useState<string>("5");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [stockRes, moveRes] = await Promise.all([
        fetchStockSummary(),
        fetchStockMovements({
          productId: selectedProductFilter ? Number(selectedProductFilter) : undefined,
          type: movementTypeFilter || undefined,
        }),
      ]);

      setProducts(stockRes.items || []);
      setTotalStockValue(stockRes.totalStockValue || 0);
      setLowStockCount(stockRes.lowStockCount || 0);
      setMovements(moveRes.items || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล Stock");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedProductFilter, movementTypeFilter]);

  const openAdd = () => {
    setEditProduct(null);
    const nextCode = "P" + String(products.length + 1).padStart(3, "0");
    setFormCode(nextCode);
    setFormName("");
    setFormUnit("ชิ้น");
    setFormCostPrice("");
    setFormSellPrice("");
    setFormQty("0");
    setFormLowAlert("5");
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setFormCode(p.code);
    setFormName(p.name);
    setFormUnit(p.unit || "ชิ้น");
    setFormCostPrice(String(p.cost_price));
    setFormSellPrice(String(p.sell_price));
    setFormQty(String(p.quantity));
    setFormLowAlert(String(p.low_stock_alert));
    setShowModal(true);
  };

  const openAdjust = (p: Product) => {
    setAdjustTarget(p);
    setAdjustQty("");
    setAdjustNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) {
      alert("กรุณากรอกรหัสและชื่อสินค้า");
      return;
    }

    try {
      setSubmitting(true);
      if (editProduct) {
        await updateProduct(editProduct.id, {
          code: formCode.trim(),
          name: formName.trim(),
          unit: formUnit.trim(),
          cost_price: Number(formCostPrice) || 0,
          sell_price: Number(formSellPrice) || 0,
          low_stock_alert: Number(formLowAlert) || 5,
        });
      } else {
        await createProduct({
          code: formCode.trim(),
          name: formName.trim(),
          unit: formUnit.trim(),
          cost_price: Number(formCostPrice) || 0,
          sell_price: Number(formSellPrice) || 0,
          quantity: Number(formQty) || 0,
          low_stock_alert: Number(formLowAlert) || 5,
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

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget || !adjustQty) return;
    const qty = parseInt(adjustQty);
    if (isNaN(qty) || qty === 0) {
      alert("กรุณาระบุจำนวนที่ต้องการปรับ (+ หรือ -)");
      return;
    }

    try {
      setSubmitting(true);
      await adjustStock(adjustTarget.id, qty, adjustNotes);
      setAdjustTarget(null);
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการปรับ Stock: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการปิดใช้งานสินค้านี้?")) return;
    try {
      await deleteProduct(id);
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลบสินค้า: " + err.message);
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
        <div>
          <h2 className="text-[18px] font-bold text-[#17202A]">ระบบจัดการ Stock สินค้า</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ควบคุมจำนวนคงเหลือ ต้นทุนถัวเฉลี่ย ราคาขาย และประวัติการเคลื่อนไหว
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setTab("products")}
              className={`rounded-lg px-3 py-1.5 transition ${
                tab === "products" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600"
              }`}
            >
              📦 รายการสินค้า ({products.length})
            </button>
            <button
              onClick={() => setTab("movements")}
              className={`rounded-lg px-3 py-1.5 transition ${
                tab === "movements" ? "bg-white text-blue-600 shadow-xs" : "text-slate-600"
              }`}
            >
              🔄 ประวัติ Stock Movement
            </button>
          </div>
          <button
            onClick={openAdd}
            className="rounded-xl bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition"
          >
            + เพิ่มสินค้าใหม่
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 shadow-xs">
          <div className="text-xs text-blue-800 font-semibold">มูลค่า Stock รวม (ตามราคาทุน)</div>
          <div className="text-2xl font-bold text-[#2563EB] mt-1">
            {formatAmount(totalStockValue)} บาท
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">สินค้าพร้อมขายทั้งหมด</div>
          <div className="text-2xl font-bold text-slate-800 mt-1">
            {products.reduce((sum, p) => sum + p.quantity, 0)} ชิ้น
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
          <div className="text-xs text-amber-800 font-semibold">สินค้าแจ้งเตือนใกล้หมด (Low Stock)</div>
          <div className="text-2xl font-bold text-amber-900 mt-1">
            {lowStockCount} รายการ
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {tab === "products" ? (
        <>
          {/* Search bar */}
          <div className="flex items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
            <input
              type="text"
              placeholder="ค้นหาชื่อสินค้า หรือ รหัสสินค้า..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 rounded-xl border border-[#E2E8F0] px-4 py-2 text-xs text-slate-800 focus:outline-[#2563EB]"
            />
          </div>

          {/* Product Table */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-600">
                    <th className="py-3.5 px-5">รหัส</th>
                    <th className="py-3.5 px-4">ชื่อสินค้า</th>
                    <th className="py-3.5 px-4 text-right">ราคาทุน (เฉลี่ย)</th>
                    <th className="py-3.5 px-4 text-right">ราคาขาย</th>
                    <th className="py-3.5 px-4 text-right">คงเหลือ</th>
                    <th className="py-3.5 px-4 text-right">มูลค่า Stock</th>
                    <th className="py-3.5 px-5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        กำลังโหลดข้อมูลสินค้า...
                      </td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        ไม่พบข้อมูลสินค้า
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isLow = p.quantity <= p.low_stock_alert;
                      const stockVal = p.quantity * Number(p.cost_price);
                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-5 font-mono text-xs font-semibold text-slate-500 whitespace-nowrap">
                            {p.code}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-900">
                            {p.name}
                            <span className="ml-2 text-xs font-normal text-slate-400">({p.unit})</span>
                          </td>
                          <td className="py-3.5 px-4 text-right text-slate-600 whitespace-nowrap">
                            {formatAmount(Number(p.cost_price))} บ.
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-900 whitespace-nowrap">
                            {formatAmount(Number(p.sell_price))} บ.
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isLow
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {p.quantity} {p.unit}
                              {isLow && " ⚠️"}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right font-medium text-blue-700 whitespace-nowrap">
                            {formatAmount(stockVal)} บ.
                          </td>
                          <td className="py-3.5 px-5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openAdjust(p)}
                                className="text-xs text-amber-600 hover:underline font-medium"
                              >
                                ปรับ Stock
                              </button>
                              <button
                                onClick={() => openEdit(p)}
                                className="text-xs text-slate-600 hover:text-blue-600 font-medium"
                              >
                                แก้ไข
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                className="text-xs text-red-600 hover:underline font-medium"
                              >
                                ลบ
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Stock Movement Tab */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">สินค้า:</span>
              <select
                value={selectedProductFilter}
                onChange={(e) => setSelectedProductFilter(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
              >
                <option value="">สินค้าทั้งหมด</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">ประเภท Movement:</span>
              <select
                value={movementTypeFilter}
                onChange={(e) => setMovementTypeFilter(e.target.value)}
                className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
              >
                <option value="">ทุกประเภท</option>
                <option value="PURCHASE">PURCHASE (ซื้อสินค้าเข้า)</option>
                <option value="SALE">SALE (ขายสินค้าออก)</option>
                <option value="ADJUSTMENT">ADJUSTMENT (ปรับสต็อก)</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-600">
                    <th className="py-3.5 px-5">วันที่/เวลา</th>
                    <th className="py-3.5 px-4">สินค้า</th>
                    <th className="py-3.5 px-4">ประเภท</th>
                    <th className="py-3.5 px-4 text-right">จำนวนที่เปลี่ยน</th>
                    <th className="py-3.5 px-4 text-right">ก่อนหน้า</th>
                    <th className="py-3.5 px-4 text-right">หลังเปลี่ยน</th>
                    <th className="py-3.5 px-5">หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {movements.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        ยังไม่มีประวัติการเคลื่อนไหว Stock
                      </td>
                    </tr>
                  ) : (
                    movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-5 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(m.created_at)} {m.created_at?.slice(11, 16)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {m.product_name} <span className="text-xs font-normal text-slate-400">({m.product_code})</span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {m.type === "PURCHASE" && (
                            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                              + ซื้อสินค้า (PURCHASE)
                            </span>
                          )}
                          {m.type === "SALE" && (
                            <span className="rounded bg-rose-50 px-2 py-0.5 text-xs font-bold text-rose-700">
                              - ขายสินค้า (SALE)
                            </span>
                          )}
                          {m.type === "ADJUSTMENT" && (
                            <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">
                              ⚙️ ปรับยอด (ADJUSTMENT)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold whitespace-nowrap">
                          <span className={m.quantity >= 0 ? "text-emerald-600" : "text-rose-600"}>
                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity} {m.unit}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-500 whitespace-nowrap">{m.quantity_before}</td>
                        <td className="py-3.5 px-4 text-right font-bold text-slate-800 whitespace-nowrap">{m.quantity_after}</td>
                        <td className="py-3.5 px-5 text-xs text-slate-500">{m.notes || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showModal && (
        <Modal
          title={editProduct ? "แก้ไขสินค้า" : "เพิ่มสินค้าใหม่"}
          onClose={() => setShowModal(false)}
          onSubmit={handleSubmit}
          loading={submitting}
        >
          <div className="grid grid-cols-2 gap-4">
            <Field label="รหัสสินค้า" required>
              <Input
                placeholder="P001"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                required
              />
            </Field>
            <Field label="หน่วยนับ">
              <Input
                placeholder="ชิ้น, กล่อง, แก้ว"
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
              />
            </Field>
          </div>

          <Field label="ชื่อสินค้า" required>
            <Input
              placeholder="เช่น กาแฟอาราบิก้า, เสื้อยืด"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="ราคาทุน (บาท)">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formCostPrice}
                onChange={(e) => setFormCostPrice(e.target.value)}
              />
            </Field>
            <Field label="ราคาขาย (บาท)">
              <Input
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formSellPrice}
                onChange={(e) => setFormSellPrice(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {!editProduct && (
              <Field label="จำนวนเริ่มต้น">
                <Input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                />
              </Field>
            )}
            <Field label="จุดแจ้งเตือน Stock ต่ำ">
              <Input
                type="number"
                min="0"
                placeholder="5"
                value={formLowAlert}
                onChange={(e) => setFormLowAlert(e.target.value)}
              />
            </Field>
          </div>
        </Modal>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <Modal
          title={`ปรับปรุงจำนวน Stock: ${adjustTarget.name}`}
          onClose={() => setAdjustTarget(null)}
          onSubmit={handleAdjustSubmit}
          loading={submitting}
          submitLabel="ยืนยันการปรับยอด"
        >
          <div className="bg-slate-50 p-4 rounded-xl text-xs space-y-1 mb-2">
            <div>
              <span className="text-slate-400">รหัส:</span> <span className="font-semibold text-slate-700">{adjustTarget.code}</span>
            </div>
            <div>
              <span className="text-slate-400">จำนวนปัจจุบัน:</span>{" "}
              <span className="font-bold text-slate-900 text-sm">{adjustTarget.quantity} {adjustTarget.unit}</span>
            </div>
          </div>

          <Field label="จำนวนที่ต้องการปรับ (ใส่ + เพิ่ม หรือ - ลด)" required>
            <Input
              type="number"
              placeholder="เช่น +5 หรือ -2"
              value={adjustQty}
              onChange={(e) => setAdjustQty(e.target.value)}
              required
            />
          </Field>

          <Field label="เหตุผล / หมายเหตุ">
            <Input
              placeholder="เช่น สินค้าชำรุด, นับสต็อกประจำเดือน"
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
            />
          </Field>
        </Modal>
      )}
    </div>
  );
}
