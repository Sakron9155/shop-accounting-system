import { useState, useEffect } from "react";
import {
  fetchExpenseList,
  createExpenseBatch,
  updateExpense,
  deleteExpense,
  fetchExpenseById,
  Expense as ExpenseType,
} from "../services/expenses";
import { fetchSettings, ExpenseCategory } from "../services/settings";
import { fetchProducts, Product } from "../services/products";
import { formatAmount, formatDate, todayStr, monthStartStr } from "../utils/format";
import Modal from "../components/Modal";
import Field, { Input, Select, Textarea } from "../components/Field";
import ProductSearchSelect from "../components/ProductSearchSelect";
import QuickAddProductModal from "../components/QuickAddProductModal";

interface BatchItemRow {
  id: string;
  category_id: string;
  description: string;
  amount: string;
  notes: string;
  // If cost_of_goods
  product_id: string;
  quantity: string;
  unit_price: string;
}

interface EditItemRow {
  id: string;
  product_id: string;
  item_name: string;
  quantity: string;
  unit_price: string;
}

export default function Expense() {
  const [expenses, setExpenses] = useState<ExpenseType[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Filters
  const [startDate, setStartDate] = useState<string>(monthStartStr());
  const [endDate, setEndDate] = useState<string>(todayStr());
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Add Batch Modal State
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [batchDate, setBatchDate] = useState<string>(todayStr());
  const [batchNote, setBatchNote] = useState<string>("");
  const [batchItems, setBatchItems] = useState<BatchItemRow[]>([]);

  // Edit Single Item State
  const [editItem, setEditItem] = useState<ExpenseType | null>(null);
  const [editDate, setEditDate] = useState<string>(todayStr());
  const [editDesc, setEditDesc] = useState<string>("");
  const [editAmount, setEditAmount] = useState<string>("");
  const [editCategoryId, setEditCategoryId] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");

  // Submitting state
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Detail Modal State
  const [detailItem, setDetailItem] = useState<ExpenseType | null>(null);

  // Quick Add Product Modal State
  const [quickAddModalOpen, setQuickAddModalOpen] = useState<boolean>(false);
  const [quickAddInitialName, setQuickAddInitialName] = useState<string>("");
  const [quickAddTargetRowId, setQuickAddTargetRowId] = useState<string | null>(null);

  // Edit Items State (for cost_of_goods / equipment)
  const [editItems, setEditItems] = useState<EditItemRow[]>([]);
  const [editCategoryType, setEditCategoryType] = useState<string>("");
  const [editItemsLoading, setEditItemsLoading] = useState<boolean>(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [expRes, settingsRes, prodRes] = await Promise.all([
        fetchExpenseList({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          categoryId: selectedCategory ? Number(selectedCategory) : undefined,
          search: search || undefined,
        }),
        fetchSettings(),
        fetchProducts(),
      ]);

      setExpenses(expRes.items);
      setSummary(expRes.summary);
      setCategories(settingsRes.expenseCategories || []);
      setProducts(prodRes.items || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "เกิดข้อผิดพลาดในการโหลดข้อมูลรายจ่าย");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [startDate, endDate, selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Open Multi-item Batch Add Modal
  const openAddBatch = () => {
    setBatchDate(todayStr());
    setBatchNote("");

    // Default category: find cost_of_goods or first category
    const defaultCat =
      categories.find((c) => c.type === "cost_of_goods") || categories[0];
    const isCog = defaultCat?.type === "cost_of_goods";
    const firstProd = products[0];

    const initialRow: BatchItemRow = {
      id: Math.random().toString(36).substring(2),
      category_id: defaultCat ? String(defaultCat.id) : "",
      description: isCog && firstProd ? `ซื้อสินค้า: ${firstProd.name}` : "",
      amount:
        isCog && firstProd && firstProd.cost_price
          ? String(firstProd.cost_price)
          : "",
      notes: "",
      product_id: isCog && firstProd ? String(firstProd.id) : "",
      quantity: "1",
      unit_price:
        isCog && firstProd && firstProd.cost_price
          ? String(firstProd.cost_price)
          : "0",
    };

    setBatchItems([initialRow]);
    setShowAddModal(true);
  };

  // Add a new row in Batch Modal
  const addBatchRow = () => {
    const defaultCat =
      categories.find((c) => c.type === "operating") || categories[0];

    setBatchItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2) + Date.now().toString(36),
        category_id: defaultCat ? String(defaultCat.id) : "",
        description: "",
        amount: "",
        notes: "",
        product_id: "",
        quantity: "1",
        unit_price: "0",
      },
    ]);
  };

  // Remove row from Batch Modal
  const removeBatchRow = (id: string) => {
    setBatchItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Quick Add Product Success Handlers
  const handleQuickAddSuccess = (newProduct: Product) => {
    // 1. Add to products list immediately so all rows have access
    setProducts((prev) => [
      newProduct,
      ...prev.filter((p) => p.id !== newProduct.id),
    ]);

    // 2. If a target row triggered this modal, select the product in that row
    if (quickAddTargetRowId) {
      setBatchItems((prev) =>
        prev.map((item) => {
          if (item.id !== quickAddTargetRowId) return item;
          const qty =
            item.quantity && parseInt(item.quantity) > 0
              ? parseInt(item.quantity)
              : 1;
          const unitPrice = newProduct.cost_price || 0;
          return {
            ...item,
            product_id: String(newProduct.id),
            unit_price: String(unitPrice),
            quantity: String(qty),
            amount: (qty * unitPrice).toFixed(2),
            description:
              !item.description ||
              products.some((x) => item.description.includes(x.name)) ||
              item.description.startsWith("ซื้อสินค้า:")
                ? `ซื้อสินค้า: ${newProduct.name}`
                : item.description,
          };
        }),
      );
    }

    setQuickAddModalOpen(false);
    setQuickAddTargetRowId(null);
  };

  const handleSelectExistingProduct = (existingProduct: Product) => {
    if (quickAddTargetRowId) {
      setBatchItems((prev) =>
        prev.map((item) => {
          if (item.id !== quickAddTargetRowId) return item;
          const qty =
            item.quantity && parseInt(item.quantity) > 0
              ? parseInt(item.quantity)
              : 1;
          const unitPrice = existingProduct.cost_price || 0;
          return {
            ...item,
            product_id: String(existingProduct.id),
            unit_price: String(unitPrice),
            quantity: String(qty),
            amount: (qty * unitPrice).toFixed(2),
            description:
              !item.description ||
              products.some((x) => item.description.includes(x.name)) ||
              item.description.startsWith("ซื้อสินค้า:")
                ? `ซื้อสินค้า: ${existingProduct.name}`
                : item.description,
          };
        }),
      );
    }

    setQuickAddModalOpen(false);
    setQuickAddTargetRowId(null);
  };

  // Update a field in a Batch Row
  const updateBatchRow = (
    id: string,
    field: keyof BatchItemRow,
    value: string,
  ) => {
    setBatchItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;

        const updated = { ...item, [field]: value };
        const cat = categories.find((c) => String(c.id) === (field === "category_id" ? value : item.category_id));
        const isCog = cat?.type === "cost_of_goods";

        if (field === "category_id") {
          if (isCog) {
            if (!item.product_id && products.length > 0) {
              const p = products[0];
              updated.product_id = String(p.id);
              updated.unit_price = String(p.cost_price || 0);
              updated.quantity =
                item.quantity && parseInt(item.quantity) > 0
                  ? item.quantity
                  : "1";
              updated.amount = (
                (parseInt(updated.quantity) || 1) * (p.cost_price || 0)
              ).toFixed(2);
              if (
                !item.description ||
                products.some((x) => item.description.includes(x.name)) ||
                item.description.startsWith("ซื้อสินค้า:")
              ) {
                updated.description = `ซื้อสินค้า: ${p.name}`;
              }
            } else if (!item.product_id) {
              updated.quantity =
                item.quantity && parseInt(item.quantity) > 0
                  ? item.quantity
                  : "1";
              updated.unit_price = item.unit_price || "0";
              updated.amount = (
                (parseInt(updated.quantity) || 1) *
                (parseFloat(updated.unit_price) || 0)
              ).toFixed(2);
            }
          }
        } else if (field === "product_id") {
          const p = products.find((x) => String(x.id) === value);
          if (p) {
            updated.product_id = String(p.id);
            updated.unit_price = String(p.cost_price || 0);
            const qty =
              item.quantity && parseInt(item.quantity) > 0
                ? parseInt(item.quantity)
                : 1;
            updated.quantity = String(qty);
            updated.amount = (qty * (p.cost_price || 0)).toFixed(2);
            if (
              !item.description ||
              products.some((x) => item.description.includes(x.name)) ||
              item.description.startsWith("ซื้อสินค้า:")
            ) {
              updated.description = `ซื้อสินค้า: ${p.name}`;
            }
          } else {
            updated.product_id = "";
          }
        } else if (field === "quantity") {
          const qty = parseInt(value) || 0;
          const price = parseFloat(item.unit_price) || 0;
          updated.quantity = value;
          updated.amount = (qty * price).toFixed(2);
        } else if (field === "unit_price") {
          const qty = parseInt(item.quantity) || 0;
          const price = parseFloat(value) || 0;
          updated.unit_price = value;
          updated.amount = (qty * price).toFixed(2);
        } else if (field === "amount") {
          const total = parseFloat(value) || 0;
          updated.amount = value;
          const qty = parseInt(item.quantity) || 1;
          if (isCog && qty > 0) {
            updated.unit_price = (total / qty).toFixed(2);
          }
        }

        return updated;
      }),
    );
  };

  // Submit Batch Expenses
  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchDate) {
      alert("กรุณาระบุวันที่");
      return;
    }
    if (batchItems.length === 0) {
      alert("กรุณาเพิ่มรายการรายจ่ายอย่างน้อย 1 รายการ");
      return;
    }

    // Validation
    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i];
      const itemNum = i + 1;

      if (!item.category_id) {
        alert(`รายการที่ ${itemNum}: กรุณาเลือกหมวดหมู่รายจ่าย`);
        return;
      }
      if (!item.description.trim()) {
        alert(`รายการที่ ${itemNum}: กรุณาระบุชื่อรายการ/คำอธิบาย`);
        return;
      }
      const amount = parseFloat(item.amount);
      if (isNaN(amount) || amount <= 0) {
        alert(`รายการที่ ${itemNum}: จำนวนเงินต้องมากกว่า 0 บาท`);
        return;
      }

      const cat = categories.find((c) => String(c.id) === item.category_id);
      if (cat?.type === "cost_of_goods") {
        if (!item.product_id) {
          alert(`รายการที่ ${itemNum}: กรุณาเลือกสินค้าที่จะเพิ่ม Stock`);
          return;
        }
        const qty = parseInt(item.quantity);
        if (isNaN(qty) || qty <= 0) {
          alert(`รายการที่ ${itemNum}: จำนวนสินค้าต้องมากกว่า 0`);
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      await createExpenseBatch({
        date: batchDate,
        note: batchNote.trim(),
        notes: batchNote.trim(),
        items: batchItems.map((item) => {
          const cat = categories.find((c) => String(c.id) === item.category_id);
          const isCog = cat?.type === "cost_of_goods";
          return {
            expense_category_id: Number(item.category_id),
            category: cat?.type,
            description: item.description.trim(),
            amount: parseFloat(item.amount),
            notes: item.notes.trim() || undefined,
            product_id: isCog && item.product_id ? Number(item.product_id) : undefined,
            quantity: isCog && item.quantity ? parseInt(item.quantity) : undefined,
            unit_price:
              isCog && item.unit_price ? parseFloat(item.unit_price) : undefined,
          };
        }),
      });

      setShowAddModal(false);
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการบันทึกรายจ่าย: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Open Edit Single Item
  const openEdit = async (item: ExpenseType) => {
    setEditItem(item);
    setEditDate(item.date?.split("T")[0] || todayStr());
    setEditDesc(item.description);
    setEditAmount(String(item.amount));
    const catId = item.expense_category_id ? String(item.expense_category_id) : "";
    setEditCategoryId(catId);
    setEditNotes(item.notes || "");
    setEditCategoryType(item.category_type || "");
    setEditItems([]);

    // Load items for cost_of_goods or equipment
    if (item.category_type === "cost_of_goods" || item.category_type === "equipment") {
      setEditItemsLoading(true);
      try {
        const full = await fetchExpenseById(item.id);
        if (full.items && full.items.length > 0) {
          setEditItems(
            full.items.map((ei) => ({
              id: String(ei.id),
              product_id: ei.product_id ? String(ei.product_id) : "",
              item_name: ei.item_name,
              quantity: String(ei.quantity),
              unit_price: String(ei.unit_price),
            })),
          );
        }
      } catch (err) {
        console.error("Failed to load expense items:", err);
      } finally {
        setEditItemsLoading(false);
      }
    }
  };

  // Submit Edit Single Item
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;
    if (!editDesc.trim() || !editAmount || Number(editAmount) <= 0) {
      alert("กรุณากรอกข้อมูลให้ถูกต้อง (จำนวนเงินต้องมากกว่า 0)");
      return;
    }

    const selectedCat = categories.find((c) => String(c.id) === editCategoryId);
    const isCogEdit = selectedCat?.type === "cost_of_goods";

    if (isCogEdit && editItems.length === 0) {
      alert("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ");
      return;
    }

    try {
      setSubmitting(true);
      const payload: Record<string, unknown> = {
        date: editDate,
        description: editDesc.trim(),
        amount: Number(editAmount),
        expense_category_id: editCategoryId ? Number(editCategoryId) : null,
        notes: editNotes,
      };

      if (isCogEdit && editItems.length > 0) {
        payload.items = editItems.map((ei) => ({
          product_id: ei.product_id ? Number(ei.product_id) : null,
          item_name: ei.item_name,
          quantity: parseInt(ei.quantity) || 1,
          unit_price: parseFloat(ei.unit_price) || 0,
        }));
      }

      await updateExpense(editItem.id, payload);
      setEditItem(null);
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการแก้ไข: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Item
  const handleDelete = async (id: number) => {
    if (
      !confirm(
        "คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้? หากเป็นรายการซื้อสินค้า Stock จะถูกปรับลดลงอัตโนมัติ",
      )
    )
      return;
    try {
      await deleteExpense(id);
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาดในการลบ: " + err.message);
    }
  };

  // View Detail Modal
  const viewDetail = async (id: number) => {
    try {
      const full = await fetchExpenseById(id);
      setDetailItem(full);
    } catch (err: any) {
      alert("ไม่สามารถดูรายละเอียดได้: " + err.message);
    }
  };

  const totalAllExpenses = Object.values(summary).reduce((a, b) => a + b, 0);
  const totalBatchAmount = batchItems.reduce(
    (sum, item) => sum + (parseFloat(item.amount) || 0),
    0,
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
        <div>
          <h2 className="text-[18px] font-bold text-[#17202A]">รายการรายจ่าย</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            บันทึกต้นทุนสินค้า (เพิ่ม Stock), ค่าใช้จ่ายดำเนินงาน และอุปกรณ์
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={openAddBatch}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-blue-700 active:scale-98 cursor-pointer"
          >
            <span className="text-sm font-bold leading-none">+</span>
            <span>เพิ่มรายจ่าย</span>
          </button>
        </div>
      </div>

      {/* Summary Cards by Category Type */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 shadow-xs">
          <div className="text-xs text-amber-800 font-semibold">
            1. ซื้อสินค้า (เข้า Stock)
          </div>
          <div className="text-xl font-bold text-amber-900 mt-1">
            {formatAmount(summary["cost_of_goods"] || 0)} บ.
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">
            2. ค่าใช้จ่ายดำเนินงาน
          </div>
          <div className="text-xl font-bold text-slate-800 mt-1">
            {formatAmount(summary["operating"] || 0)} บ.
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs text-slate-500 font-semibold">
            3. อุปกรณ์ (ไม่เพิ่ม Stock)
          </div>
          <div className="text-xl font-bold text-slate-800 mt-1">
            {formatAmount(summary["equipment"] || 0)} บ.
          </div>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 shadow-xs">
          <div className="text-xs text-rose-800 font-semibold">
            รวมรายจ่ายทั้งหมด
          </div>
          <div className="text-xl font-bold text-[#EF4444] mt-1">
            -{formatAmount(totalAllExpenses)} บ.
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
        <form
          onSubmit={handleSearchSubmit}
          className="flex flex-1 flex-wrap items-center gap-3 min-w-[300px]"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">
              ตั้งแต่วันที่:
            </span>
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
            <span className="text-xs font-semibold text-slate-600">
              หมวดหมู่:
            </span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            >
              <option value="">ทุกหมวดหมู่</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <input
              type="text"
              placeholder="ค้นหารายจ่าย..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-[#E2E8F0] px-3 py-1.5 text-xs text-slate-800 focus:outline-[#2563EB]"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 cursor-pointer"
            >
              ค้นหา
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Expense Table */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[13px] font-semibold text-slate-600">
                <th className="py-3.5 px-5">วันที่</th>
                <th className="py-3.5 px-4">รายการ</th>
                <th className="py-3.5 px-4">หมวดหมู่</th>
                <th className="py-3.5 px-4">ประเภทบัญชี</th>
                <th className="py-3.5 px-4 text-right">จำนวนเงิน</th>
                <th className="py-3.5 px-5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    กำลังโหลดข้อมูล...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    ไม่มีรายการรายจ่ายในช่วงเวลานี้
                  </td>
                </tr>
              ) : (
                expenses.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-slate-50/70 transition"
                  >
                    <td className="py-3.5 px-5 text-slate-600 font-medium whitespace-nowrap">
                      {formatDate(item.date)}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      {item.description}
                      {item.notes && (
                        <div className="text-xs font-normal text-slate-400">
                          {item.notes}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-700">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium">
                        {item.category_name || "อื่นๆ"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {item.category_type === "cost_of_goods" && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          📦 ต้นทุนสินค้า (เข้า Stock)
                        </span>
                      )}
                      {item.category_type === "operating" && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          🏢 ค่าใช้จ่ายดำเนินงาน
                        </span>
                      )}
                      {item.category_type === "equipment" && (
                        <span className="rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                          🛠️ อุปกรณ์
                        </span>
                      )}
                      {(!item.category_type ||
                        item.category_type === "other") && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          อื่นๆ
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#EF4444] whitespace-nowrap">
                      -{formatAmount(item.amount)} บ.
                    </td>
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        {(item.category_type === "cost_of_goods" ||
                          item.category_type === "equipment") && (
                          <button
                            onClick={() => viewDetail(item.id)}
                            className="text-xs text-blue-600 hover:underline font-medium cursor-pointer"
                          >
                            ดูรายการ
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

      {/* Add Expense Batch Modal */}
      {showAddModal && (
        <Modal
          title="บันทึกรายจ่าย"
          onClose={() => setShowAddModal(false)}
          onSubmit={handleBatchSubmit}
          loading={submitting}
          submitLabel="บันทึกทั้งหมด"
          maxWidth="max-w-4xl"
        >
          {/* Top Form: Date and General Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <Field label="วันที่" required>
              <Input
                type="date"
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                required
              />
            </Field>

            <Field label="หมายเหตุรวม (ถ้ามี)">
              <Input
                type="text"
                placeholder="ระบุหมายเหตุรวมสำหรับชุดรายจ่ายนี้..."
                value={batchNote}
                onChange={(e) => setBatchNote(e.target.value)}
              />
            </Field>
          </div>

          {/* Section: รายการรายจ่าย */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  รายการรายจ่าย
                </h3>
                <p className="text-xs text-slate-500">
                  ระบุรายละเอียดแต่ละรายการ และเลือกหมวดหมู่ที่ต้องการ
                </p>
              </div>
              <button
                type="button"
                onClick={addBatchRow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#2563EB] bg-blue-50/50 px-3 py-1.5 text-xs font-semibold text-[#2563EB] hover:bg-blue-100/70 transition cursor-pointer"
              >
                <span>+</span> เพิ่มรายการ
              </button>
            </div>

            {/* List of Dynamic Rows */}
            <div className="space-y-4">
              {batchItems.map((item, index) => {
                const cat = categories.find(
                  (c) => String(c.id) === item.category_id,
                );
                const isCog = cat?.type === "cost_of_goods";
                const isEquip = cat?.type === "equipment";

                // Category groups for type-selector buttons
                const cogCat = categories.find((c) => c.type === "cost_of_goods");
                const equipCat = categories.find((c) => c.type === "equipment");
                const opCats = categories.filter(
                  (c) => c.type === "operating" || (!c.type && c.type !== "cost_of_goods" && c.type !== "equipment"),
                );
                const firstOpCat = opCats[0];
                const isOp = !isCog && !isEquip;

                return (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className={`flex items-center justify-between px-4 py-2.5 border-b ${
                      isCog ? "bg-amber-50 border-amber-100" :
                      isEquip ? "bg-purple-50 border-purple-100" :
                      "bg-slate-50 border-slate-100"
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                          isCog ? "bg-amber-200 text-amber-800" :
                          isEquip ? "bg-purple-200 text-purple-800" :
                          "bg-blue-100 text-blue-700"
                        }`}>
                          {index + 1}
                        </span>
                        <span className="text-xs font-semibold text-slate-600">
                          รายการที่ {index + 1}
                        </span>
                        {isCog && <span className="text-[10px] text-amber-600 font-medium">· ต้นทุนสินค้า เพิ่ม Stock</span>}
                        {isEquip && <span className="text-[10px] text-purple-600 font-medium">· อุปกรณ์</span>}
                        {isOp && <span className="text-[10px] text-blue-600 font-medium">· ค่าดำเนินงาน</span>}
                      </div>
                      {batchItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeBatchRow(item.id)}
                          className="text-[11px] font-medium text-red-400 hover:text-red-600 transition cursor-pointer px-2 py-0.5 rounded-md hover:bg-red-50"
                        >
                          ✕ ลบ
                        </button>
                      )}
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Step 1: Type Selector Buttons */}
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">ประเภทรายจ่าย</div>
                        <div className="grid grid-cols-3 gap-2">
                          {cogCat && (
                            <button
                              type="button"
                              onClick={() => updateBatchRow(item.id, "category_id", String(cogCat.id))}
                              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 py-3 text-[11px] font-bold transition cursor-pointer ${
                                isCog
                                  ? "border-amber-400 bg-amber-50 text-amber-800 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-amber-300 hover:bg-amber-50/40"
                              }`}
                            >
                              <span className="text-base">📦</span>
                              <span>ต้นทุนสินค้า</span>
                              <span className="text-[9px] font-normal opacity-60">เพิ่ม Stock</span>
                            </button>
                          )}
                          {firstOpCat && (
                            <button
                              type="button"
                              onClick={() =>
                                updateBatchRow(
                                  item.id,
                                  "category_id",
                                  opCats.some((c) => String(c.id) === item.category_id)
                                    ? item.category_id
                                    : String(firstOpCat.id),
                                )
                              }
                              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 py-3 text-[11px] font-bold transition cursor-pointer ${
                                isOp
                                  ? "border-blue-400 bg-blue-50 text-blue-800 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:bg-blue-50/40"
                              }`}
                            >
                              <span className="text-base">🏢</span>
                              <span>ค่าดำเนินงาน</span>
                              <span className="text-[9px] font-normal opacity-60">ค่าไฟ, ค่าเช่า</span>
                            </button>
                          )}
                          {equipCat && (
                            <button
                              type="button"
                              onClick={() => updateBatchRow(item.id, "category_id", String(equipCat.id))}
                              className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 py-3 text-[11px] font-bold transition cursor-pointer ${
                                isEquip
                                  ? "border-purple-400 bg-purple-50 text-purple-800 shadow-sm"
                                  : "border-slate-200 bg-white text-slate-500 hover:border-purple-300 hover:bg-purple-50/40"
                              }`}
                            >
                              <span className="text-base">🛠️</span>
                              <span>อุปกรณ์</span>
                              <span className="text-[9px] font-normal opacity-60">ไม่เพิ่ม Stock</span>
                            </button>
                          )}
                        </div>

                        {/* Sub-category selector for operating (if multiple) */}
                        {isOp && opCats.length > 1 && (
                          <div className="mt-2">
                            <label className="text-[10px] font-semibold text-slate-500 block mb-1">หมวดหมู่ย่อย</label>
                            <select
                              value={item.category_id}
                              onChange={(e) =>
                                updateBatchRow(item.id, "category_id", e.target.value)
                              }
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
                            >
                              {opCats.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      {/* Step 2: Description + Amount */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            รายการ / คำอธิบาย <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder={
                              isCog ? "เช่น ซื้อสินค้าเข้าคลัง" :
                              isEquip ? "เช่น ชั้นวาง, โต๊ะ, เครื่องมือ" :
                              "เช่น ค่าไฟ, ค่าเช่า, ค่าน้ำ"
                            }
                            value={item.description}
                            onChange={(e) =>
                              updateBatchRow(item.id, "description", e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-blue-400 focus:bg-white focus:outline-none"
                            required
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-slate-600 block mb-1">
                            จำนวนเงิน (บาท) <span className="text-red-500">*</span>
                            {isCog && (
                              <span className="text-[9px] text-amber-600 font-normal ml-1">
                                คำนวณอัตโนมัติ
                              </span>
                            )}
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            value={item.amount}
                            onChange={(e) =>
                              updateBatchRow(item.id, "amount", e.target.value)
                            }
                            className={`w-full rounded-lg border px-3 py-2 text-xs font-bold text-right focus:outline-none ${
                              isCog
                                ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-400"
                                : isEquip
                                ? "border-purple-200 bg-purple-50/40 text-purple-900 focus:border-purple-400"
                                : "border-slate-200 bg-white text-slate-800 focus:border-blue-400"
                            }`}
                            required
                          />
                        </div>
                      </div>

                      {/* Step 3: Stock section for cost_of_goods only */}
                      {isCog && (
                        <div className="rounded-xl border border-amber-200 bg-gradient-to-b from-amber-50/60 to-white p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                              <span>📦</span>
                              <span>ข้อมูลสินค้าที่จะเพิ่มเข้า Stock</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setQuickAddInitialName("");
                                setQuickAddTargetRowId(item.id);
                                setQuickAddModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:bg-amber-200 transition cursor-pointer border border-amber-200"
                            >
                              + เพิ่มสินค้าใหม่
                            </button>
                          </div>

                          {/* Product selector */}
                          <div>
                            <label className="text-[10px] font-semibold text-amber-950 block mb-1">
                              เลือกสินค้า <span className="text-red-500">*</span>
                            </label>
                            <ProductSearchSelect
                              products={products}
                              selectedProductId={item.product_id}
                              onSelectProduct={(p) => {
                                updateBatchRow(
                                  item.id,
                                  "product_id",
                                  p ? String(p.id) : "",
                                );
                              }}
                              onOpenAddProductModal={(searchQuery) => {
                                setQuickAddInitialName(searchQuery);
                                setQuickAddTargetRowId(item.id);
                                setQuickAddModalOpen(true);
                              }}
                              required
                            />
                          </div>

                          {/* Qty + Unit price in clean 2-col grid */}
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-semibold text-amber-900 block mb-1">
                                จำนวน <span className="text-red-500">*</span>
                              </label>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min="1"
                                  placeholder="1"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateBatchRow(item.id, "quantity", e.target.value)
                                  }
                                  className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 text-right font-semibold focus:border-amber-500 focus:outline-none"
                                  required
                                />
                                <span className="text-xs text-slate-500 shrink-0 min-w-[28px] text-center">
                                  {products.find(
                                    (p) => String(p.id) === item.product_id,
                                  )?.unit || "ชิ้น"}
                                </span>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-semibold text-amber-900 block mb-1">
                                ราคาทุน / หน่วย
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={item.unit_price}
                                onChange={(e) =>
                                  updateBatchRow(item.id, "unit_price", e.target.value)
                                }
                                className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 text-right font-semibold focus:border-amber-500 focus:outline-none"
                              />
                            </div>
                          </div>

                          {/* Real-time total */}
                          <div className="flex items-center justify-between rounded-lg bg-amber-100/70 px-3 py-2 border border-amber-200">
                            <span className="text-[11px] text-amber-700">
                              {item.quantity || 0} × {formatAmount(parseFloat(item.unit_price) || 0)} บาท
                            </span>
                            <span className="text-sm font-bold text-amber-900">
                              = {formatAmount(
                                (parseInt(item.quantity) || 0) * (parseFloat(item.unit_price) || 0),
                              )} บาท
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Add Row Button */}
            <button
              type="button"
              onClick={addBatchRow}
              className="w-full rounded-xl border-2 border-dashed border-slate-200 py-3 text-xs font-semibold text-slate-600 hover:border-[#2563EB] hover:text-[#2563EB] hover:bg-blue-50/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>+</span> เพิ่มรายการรายจ่ายอีกแถว
            </button>
          </div>

          {/* Grand Total Summary Display */}
          <div className="flex items-center justify-between rounded-xl bg-slate-900 px-5 py-3.5 text-white shadow-xs mt-4">
            <div>
              <span className="text-xs text-slate-300">
                จำนวนรวมทั้งหมด ({batchItems.length} รายการ)
              </span>
              <div className="text-xs text-slate-400">
                ยอดเงินจะถูกบันทึกแยกตามหมวดหมู่จริงในระบบ
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-300 block">รวมสุทธิ</span>
              <span className="text-xl font-bold text-amber-400">
                {formatAmount(totalBatchAmount)} บาท
              </span>
            </div>
          </div>
        </Modal>
      )}

      {/* Quick Add Product Modal */}
      <QuickAddProductModal
        isOpen={quickAddModalOpen}
        initialName={quickAddInitialName}
        existingProducts={products}
        onClose={() => {
          setQuickAddModalOpen(false);
          setQuickAddTargetRowId(null);
        }}
        onSuccess={handleQuickAddSuccess}
        onSelectExistingProduct={handleSelectExistingProduct}
      />

      {/* Edit Single Expense Modal */}
      {editItem && (
        <Modal
          title="แก้ไขรายจ่าย"
          onClose={() => setEditItem(null)}
          onSubmit={handleEditSubmit}
          loading={submitting}
          submitLabel="บันทึกการแก้ไข"
          maxWidth="max-w-2xl"
        >
          {/* Basic info grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="วันที่" required>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                required
              />
            </Field>

            <Field label="หมวดหมู่รายจ่าย" required>
              <Select
                value={editCategoryId}
                onChange={(e) => {
                  setEditCategoryId(e.target.value);
                  const cat = categories.find((c) => String(c.id) === e.target.value);
                  setEditCategoryType(cat?.type || "");
                  // Clear items if switching away from cost_of_goods
                  if (cat?.type !== "cost_of_goods") setEditItems([]);
                }}
                required
              >
                <option value="">-- เลือกหมวดหมู่ --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.type === "cost_of_goods"
                      ? "📦 ต้นทุนสินค้า (เพิ่ม Stock)"
                      : c.type === "equipment"
                      ? "🛠️ อุปกรณ์"
                      : `🏢 ${c.name}`}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="รายการ / คำอธิบาย" required>
            <Input
              placeholder="เช่น ซื้อสินค้าเพิ่ม, ค่าเช่าร้าน, ค่าไฟ"
              value={editDesc}
              onChange={(e) => setEditDesc(e.target.value)}
              required
            />
          </Field>

          <Field label="จำนวนเงิน (บาท)" required>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              value={editAmount}
              onChange={(e) => setEditAmount(e.target.value)}
              required
            />
          </Field>

          <Field label="หมายเหตุ (ถ้ามี)">
            <Textarea
              placeholder="รายละเอียดเพิ่มเติม..."
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
            />
          </Field>

          {/* Items editor for cost_of_goods */}
          {(editCategoryType === "cost_of_goods" ||
            categories.find((c) => String(c.id) === editCategoryId)?.type === "cost_of_goods") && (
            <div className="mt-1 rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
                  <span>📦</span>
                  <span>รายการสินค้า (ต้นทุน)</span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditItems((prev) => [
                      ...prev,
                      {
                        id: Math.random().toString(36).substring(2),
                        product_id: "",
                        item_name: "",
                        quantity: "1",
                        unit_price: "0",
                      },
                    ])
                  }
                  className="inline-flex items-center gap-1 rounded-lg bg-amber-100 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200 transition cursor-pointer"
                >
                  + เพิ่มสินค้า
                </button>
              </div>

              {editItemsLoading ? (
                <div className="text-center text-xs text-slate-400 py-4">⏳ กำลังโหลดรายการสินค้า...</div>
              ) : editItems.length === 0 ? (
                <div className="text-center text-xs text-slate-400 py-4 border border-dashed border-amber-200 rounded-lg">
                  ยังไม่มีรายการสินค้า กดปุ่ม &ldquo;+ เพิ่มสินค้า&rdquo; เพื่อเพิ่ม
                </div>
              ) : (
                <div className="space-y-3">
                  {editItems.map((ei, idx) => (
                    <div key={ei.id} className="rounded-xl border border-amber-200 bg-white p-3 shadow-xs">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-amber-800">สินค้าที่ {idx + 1}</span>
                        {editItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setEditItems((prev) => prev.filter((x) => x.id !== ei.id))
                            }
                            className="text-xs text-red-400 hover:text-red-600 cursor-pointer px-1.5 py-0.5 rounded hover:bg-red-50"
                          >
                            ✕ ลบ
                          </button>
                        )}
                      </div>

                      <div className="mb-2">
                        <label className="text-[10px] font-semibold text-amber-900 block mb-1">เลือกสินค้า</label>
                        <ProductSearchSelect
                          products={products}
                          selectedProductId={ei.product_id}
                          onSelectProduct={(p) => {
                            setEditItems((prev) =>
                              prev.map((x) => {
                                if (x.id !== ei.id) return x;
                                return {
                                  ...x,
                                  product_id: p ? String(p.id) : "",
                                  item_name: p ? p.name : x.item_name,
                                  unit_price: p ? String(p.cost_price || 0) : x.unit_price,
                                };
                              }),
                            );
                          }}
                          onOpenAddProductModal={() => {}}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-amber-900 block mb-1">
                            จำนวน <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={ei.quantity}
                            onChange={(e) =>
                              setEditItems((prev) =>
                                prev.map((x) =>
                                  x.id !== ei.id ? x : { ...x, quantity: e.target.value },
                                ),
                              )
                            }
                            className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-right font-semibold focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-amber-900 block mb-1">
                            ราคาทุน/หน่วย (บาท)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={ei.unit_price}
                            onChange={(e) =>
                              setEditItems((prev) =>
                                prev.map((x) =>
                                  x.id !== ei.id ? x : { ...x, unit_price: e.target.value },
                                ),
                              )
                            }
                            className="w-full rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-right font-semibold focus:border-amber-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex justify-end">
                        <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg">
                          รวม: {formatAmount(
                            (parseInt(ei.quantity) || 0) * (parseFloat(ei.unit_price) || 0),
                          )} บาท
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Items total */}
              {editItems.length > 0 && (
                <div className="flex justify-between items-center rounded-lg bg-amber-900/10 px-3 py-2">
                  <span className="text-xs font-semibold text-amber-900">รวมต้นทุนสินค้า</span>
                  <span className="text-sm font-bold text-amber-900">
                    {formatAmount(
                      editItems.reduce(
                        (sum, ei) =>
                          sum + (parseInt(ei.quantity) || 0) * (parseFloat(ei.unit_price) || 0),
                        0,
                      ),
                    )} บาท
                  </span>
                </div>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Expense Detail Modal */}
      {detailItem && (
        <Modal
          title="รายละเอียดรายการค่าใช้จ่าย"
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
                <span className="font-semibold text-slate-800 ml-2">
                  {formatDate(detailItem.date)}
                </span>
              </div>
              <div>
                <span className="text-slate-400">หมวดหมู่:</span>
                <span className="font-semibold text-slate-800 ml-2">
                  {detailItem.category_name || "-"}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-400">รายการ:</span>
                <span className="font-semibold text-slate-800 ml-2">
                  {detailItem.description}
                </span>
              </div>
            </div>

            {detailItem.items && detailItem.items.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  รายการย่อย
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600 font-semibold">
                      <tr>
                        <th className="py-2.5 px-3 text-left">รายการ / สินค้า</th>
                        <th className="py-2.5 px-2 text-right">จำนวน</th>
                        <th className="py-2.5 px-2 text-right">ราคา/หน่วย</th>
                        <th className="py-2.5 px-3 text-right">ยอดรวม</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {detailItem.items.map((item) => (
                        <tr key={item.id}>
                          <td className="py-2.5 px-3 font-medium text-slate-800">
                            {item.product_name || item.item_name}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-600">
                            {item.quantity} {item.unit || "ชิ้น"}
                          </td>
                          <td className="py-2.5 px-2 text-right text-slate-600">
                            {formatAmount(item.unit_price)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {formatAmount(item.subtotal)} บ.
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center bg-rose-50 p-4 rounded-xl text-sm font-semibold">
              <div className="text-rose-900">ยอดจ่ายเงินสุทธิ</div>
              <div className="text-[#EF4444] text-base font-bold">
                -{formatAmount(detailItem.amount)} บาท
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
