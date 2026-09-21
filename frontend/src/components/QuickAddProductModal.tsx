import { useState, useEffect, useRef } from "react";
import { Product, createProduct } from "../services/products";

interface Props {
  isOpen: boolean;
  initialName?: string;
  existingProducts: Product[];
  onClose: () => void;
  onSuccess: (product: Product) => void;
  onSelectExistingProduct: (product: Product) => void;
}

const COMMON_UNITS = [
  "ชิ้น",
  "ขวด",
  "กระป๋อง",
  "กล่อง",
  "ถุง",
  "กิโลกรัม",
  "ลิตร",
  "อื่นๆ",
];

const COMMON_CATEGORIES = [
  "เครื่องดื่ม",
  "อาหาร / ของสด",
  "ขนม / ของทานเล่น",
  "วัตถุดิบ",
  "ของใช้ / บรรจุภัณฑ์",
  "อื่นๆ",
];

export default function QuickAddProductModal({
  isOpen,
  initialName = "",
  existingProducts,
  onClose,
  onSuccess,
  onSelectExistingProduct,
}: Props) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [unit, setUnit] = useState("ชิ้น");
  const [customUnit, setCustomUnit] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setCategory("");
      setCustomCategory("");
      setUnit("ชิ้น");
      setCustomUnit("");
      setError(null);
      setSubmitting(false);

      setTimeout(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      }, 50);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  // Check if name matches an existing active product
  const trimmedName = name.trim().toLowerCase();
  const duplicateProduct = trimmedName
    ? existingProducts.find(
        (p) => p.name.trim().toLowerCase() === trimmedName,
      )
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("กรุณาระบุชื่อสินค้า");
      return;
    }

    if (duplicateProduct) {
      setError(`มีสินค้าชื่อ "${duplicateProduct.name}" ในระบบแล้ว กรุณาเลือกใช้สินค้าเดิม`);
      return;
    }

    const finalUnit = unit === "อื่นๆ" ? customUnit.trim() || "ชิ้น" : unit;
    const finalCategory =
      category === "อื่นๆ" ? customCategory.trim() || undefined : category || undefined;

    try {
      setSubmitting(true);
      setError(null);

      const created = await createProduct({
        name: name.trim(),
        category: finalCategory,
        unit: finalUnit,
        cost_price: 0,
        sell_price: 0,
        quantity: 0,
      });

      onSuccess(created);
    } catch (err: any) {
      console.error("Failed to create product:", err);
      setError(err.message || "ไม่สามารถสร้างสินค้าได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative z-10 w-full max-w-md my-8 overflow-hidden rounded-2xl bg-white shadow-2xl transition-all border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-base text-[#2563EB]">
              📦
            </span>
            <div>
              <h2 className="text-base font-bold text-[#17202A]">
                เพิ่มสินค้าใหม่
              </h2>
              <p className="text-[11px] text-slate-500">
                เพิ่มสินค้าเข้าแคตตาล็อกและเลือกในรายการทันที
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Product Name Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              ชื่อสินค้า <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="เช่น โค้ก ขวด 500ml, น้ำส้ม, เมล็ดกาแฟ"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-xs text-[#17202A] placeholder-slate-400 outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-blue-100 font-medium"
            />
          </div>

          {/* Duplicate Product Warning & Quick Selection */}
          {duplicateProduct && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 shadow-xs animate-in fade-in">
              <div className="flex items-start gap-2">
                <span className="text-base">⚠️</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">
                    มีสินค้าชื่อ "{duplicateProduct.name}" อยู่ในระบบแล้ว
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    รหัส: {duplicateProduct.code} • คงเหลือใน Stock:{" "}
                    <span className="font-semibold">
                      {duplicateProduct.quantity}{" "}
                      {duplicateProduct.unit || "ชิ้น"}
                    </span>
                  </p>
                  <div className="mt-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectExistingProduct(duplicateProduct)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition shadow-xs cursor-pointer"
                    >
                      <span>✓</span>
                      <span>เลือกสินค้านี้แทน</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Product Category Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              หมวดหมู่สินค้า
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-[#17202A] outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              <option value="">-- เลือกหมวดหมู่สินค้า (ไม่บังคับ) --</option>
              {COMMON_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {category === "อื่นๆ" && (
              <input
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="ระบุหมวดหมู่สินค้า..."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-[#17202A] outline-none transition focus:border-[#2563EB] focus:bg-white"
              />
            )}
          </div>

          {/* Unit Field */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              หน่วยนับ <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-[#17202A] outline-none transition focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-blue-100"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
              {unit === "อื่นๆ" ? (
                <input
                  type="text"
                  required
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  placeholder="ระบุหน่วยนับ..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-[#17202A] outline-none transition focus:border-[#2563EB] focus:bg-white"
                />
              ) : (
                <div className="flex items-center px-3 py-2 text-[11px] text-slate-400 rounded-xl bg-slate-50 border border-slate-100">
                  ค่าเริ่มต้น: ชิ้น
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="w-full sm:w-auto rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || !!duplicateProduct || !name.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>กำลังเพิ่มสินค้า...</span>
                </>
              ) : (
                <span>เพิ่มสินค้า</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
