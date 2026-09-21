import { useState, useRef, useEffect } from "react";
import { Product } from "../services/products";
import { formatAmount } from "../utils/format";

interface Props {
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (product: Product | null) => void;
  onOpenAddProductModal: (searchQuery: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function ProductSearchSelect({
  products,
  selectedProductId,
  onSelectProduct,
  onOpenAddProductModal,
  placeholder = "🔍 ค้นหาหรือเลือกสินค้า...",
  required = false,
  disabled = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedProduct = products.find(
    (p) => String(p.id) === String(selectedProductId),
  );

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter products by search query (name or code)
  const filteredProducts = products.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = p.name.toLowerCase().includes(q);
    const codeMatch = p.code?.toLowerCase().includes(q);
    const catMatch = p.category?.toLowerCase().includes(q);
    return nameMatch || codeMatch || catMatch;
  });

  const handleOpenDropdown = () => {
    if (disabled) return;
    setIsOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleSelect = (product: Product) => {
    onSelectProduct(product);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectProduct(null);
    setSearchQuery("");
    setIsOpen(true);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  const handleCreateNew = (prefill: string) => {
    setIsOpen(false);
    onOpenAddProductModal(prefill);
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Selected Box or Input Trigger */}
      {selectedProduct && !isOpen ? (
        <div
          onClick={handleOpenDropdown}
          className={`flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-slate-800 transition cursor-pointer hover:border-amber-400 hover:bg-amber-50 ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm">📦</span>
            <div className="truncate">
              <span className="font-semibold text-slate-900">
                {selectedProduct.name}
              </span>
              {selectedProduct.code && (
                <span className="ml-1.5 rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-mono text-amber-900">
                  {selectedProduct.code}
                </span>
              )}
              <span className="ml-2 text-[11px] text-slate-500">
                (คงเหลือ {selectedProduct.quantity} {selectedProduct.unit || "ชิ้น"})
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleClear}
              className="rounded p-1 text-slate-400 hover:bg-amber-200/60 hover:text-slate-700 transition"
              title="เปลี่ยนสินค้า"
            >
              ✕
            </button>
            <span className="text-[10px] text-slate-400">▼</span>
          </div>
        </div>
      ) : (
        <div
          onClick={handleOpenDropdown}
          className={`relative flex items-center rounded-lg border border-slate-200 bg-white transition focus-within:border-[#2563EB] focus-within:ring-2 focus-within:ring-blue-100 ${
            disabled ? "opacity-60 cursor-not-allowed" : ""
          }`}
        >
          <span className="pl-3 text-slate-400 text-xs select-none">🔍</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            placeholder={
              selectedProduct ? selectedProduct.name : placeholder
            }
            disabled={disabled}
            className="w-full rounded-lg bg-transparent px-2.5 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400"
          />
          <div className="flex items-center pr-2.5 text-slate-400 gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery("");
                }}
                className="p-0.5 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
            <span className="text-[10px] pointer-events-none">▼</span>
          </div>
        </div>
      )}

      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          type="text"
          value={selectedProductId || ""}
          required
          onChange={() => {}}
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl transition-all">
          {/* Header Quick Add Button */}
          <div className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/95 p-2 backdrop-blur-xs flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-500 px-1">
              {filteredProducts.length > 0
                ? `พบสินค้า ${filteredProducts.length} รายการ`
                : "รายการสินค้า"}
            </span>
            <button
              type="button"
              onClick={() => handleCreateNew(searchQuery.trim())}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-[#2563EB] hover:bg-blue-100 transition cursor-pointer"
            >
              <span>+</span>
              <span>
                {searchQuery.trim()
                  ? `เพิ่มใหม่: "${searchQuery.trim()}"`
                  : "เพิ่มสินค้าใหม่"}
              </span>
            </button>
          </div>

          {/* List of Products */}
          {products.length === 0 ? (
            /* Empty State 1: No products in the whole system */
            <div className="p-4 text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-xl mb-2 border border-amber-200">
                📦
              </div>
              <p className="text-xs font-bold text-slate-800">
                ยังไม่มีสินค้าใน Stock
              </p>
              <p className="text-[11px] text-slate-500 mt-1 mb-3">
                คุณสามารถเพิ่มสินค้าใหม่และบันทึกรายจ่ายได้ทันทีจากหน้านี้
              </p>
              <button
                type="button"
                onClick={() => handleCreateNew(searchQuery.trim())}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
              >
                <span>+</span> เพิ่มสินค้าใหม่
              </button>
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Empty State 2: No search results matching query */
            <div className="p-4 text-center">
              <p className="text-xs text-slate-600 mb-1">
                ไม่พบสินค้า{" "}
                <span className="font-semibold text-slate-900">
                  "{searchQuery}"
                </span>
              </p>
              <p className="text-[11px] text-slate-400 mb-3">
                คุณต้องการสร้างสินค้าใหม่นี้เลยหรือไม่?
              </p>
              <button
                type="button"
                onClick={() => handleCreateNew(searchQuery.trim())}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-amber-600 transition cursor-pointer"
              >
                <span>+</span> เพิ่มสินค้าใหม่: {searchQuery}
              </button>
            </div>
          ) : (
            /* Search Results */
            <div className="divide-y divide-slate-100 py-1">
              {filteredProducts.map((p) => {
                const isSelected = String(p.id) === String(selectedProductId);
                const isLowStock = p.quantity <= (p.low_stock_alert || 5);

                return (
                  <div
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={`flex items-center justify-between px-3 py-2.5 text-xs transition cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/80 text-blue-900 font-medium"
                        : "hover:bg-slate-50 text-slate-800"
                    }`}
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-900">
                          {p.name}
                        </span>
                        {p.code && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 border border-slate-200">
                            {p.code}
                          </span>
                        )}
                        {p.category && (
                          <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-500 border border-slate-200">
                            {p.category}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500">
                        <span
                          className={`font-medium ${
                            p.quantity === 0
                              ? "text-red-500"
                              : isLowStock
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          คงเหลือ {p.quantity} {p.unit || "ชิ้น"}
                        </span>
                        {p.cost_price > 0 && (
                          <>
                            <span>•</span>
                            <span>ทุนล่าสุด ฿{formatAmount(p.cost_price)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isSelected && (
                        <span className="text-xs font-bold text-[#2563EB]">
                          ✓
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
