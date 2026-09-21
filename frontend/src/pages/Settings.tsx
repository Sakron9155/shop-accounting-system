import { useState, useEffect } from "react";
import {
  fetchSettings,
  updateShopSettings,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  ShopSettings,
  PaymentMethod,
  ExpenseCategory,
} from "../services/settings";
import Modal from "../components/Modal";
import Field, { Input, Select, Textarea } from "../components/Field";

interface Props {
  onUpdate?: () => void;
}

export default function Settings({ onUpdate }: Props) {
  const [shop, setShop] = useState<ShopSettings>({ id: 1, name: "", phone: "", address: "" });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [savingShop, setSavingShop] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Add Payment Method Modal
  const [showMethodModal, setShowMethodModal] = useState<boolean>(false);
  const [methodName, setMethodName] = useState<string>("");

  // Edit Payment Method Modal
  const [editMethodItem, setEditMethodItem] = useState<PaymentMethod | null>(null);
  const [editMethodName, setEditMethodName] = useState<string>("");

  // Add Expense Category Modal
  const [showCatModal, setShowCatModal] = useState<boolean>(false);
  const [catName, setCatName] = useState<string>("");
  const [catType, setCatType] = useState<string>("operating");

  // Edit Expense Category Modal
  const [editCatItem, setEditCatItem] = useState<ExpenseCategory | null>(null);
  const [editCatName, setEditCatName] = useState<string>("");
  const [editCatType, setEditCatType] = useState<string>("operating");

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchSettings();
      if (res.shop) setShop(res.shop);
      setPaymentMethods(res.paymentMethods || []);
      setCategories(res.expenseCategories || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "ไม่สามารถโหลดการตั้งค่าได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop.name.trim()) {
      alert("กรุณากรอกชื่อร้าน");
      return;
    }

    try {
      setSavingShop(true);
      setError(null);
      await updateShopSettings({
        name: shop.name.trim(),
        phone: shop.phone,
        address: shop.address,
      });
      setSuccessMsg("บันทึกข้อมูลร้านค้าเรียบร้อยแล้ว");
      setTimeout(() => setSuccessMsg(null), 3000);
      if (onUpdate) onUpdate();
    } catch (err: any) {
      setError(err.message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSavingShop(false);
    }
  };

  const handleAddPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!methodName.trim()) return;
    try {
      await createPaymentMethod(methodName.trim());
      setShowMethodModal(false);
      setMethodName("");
      loadData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleDeletePaymentMethod = async (id: number, name: string) => {
    if (!confirm(`คุณต้องการลบช่องทาง "${name}" ใช่หรือไม่?`)) return;
    try {
      await deletePaymentMethod(id);
      loadData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleEditPaymentMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editMethodItem || !editMethodName.trim()) return;
    try {
      await updatePaymentMethod(editMethodItem.id, editMethodName.trim());
      setEditMethodItem(null);
      setEditMethodName("");
      loadData();
      if (onUpdate) onUpdate();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    try {
      await createExpenseCategory(catName.trim(), catType);
      setShowCatModal(false);
      setCatName("");
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCatItem || !editCatName.trim()) return;
    try {
      await updateExpenseCategory(editCatItem.id, editCatName.trim(), editCatType);
      setEditCatItem(null);
      setEditCatName("");
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`คุณต้องการลบหมวดหมู่ "${name}" ใช่หรือไม่?`)) return;
    try {
      await deleteExpenseCategory(id);
      loadData();
    } catch (err: any) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
        <h2 className="text-[18px] font-bold text-[#17202A]">ตั้งค่าระบบร้านค้า</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          จัดการข้อมูลร้านค้า ช่องทางการรับเงิน และหมวดหมู่ค่าใช้จ่าย
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          ⚠️ {error}
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 font-medium">
          ✅ {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex h-48 items-center justify-center rounded-2xl bg-white border border-[#E2E8F0]">
          <div className="flex items-center gap-3 text-slate-500 text-sm">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            กำลังโหลดข้อมูลตั้งค่า...
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {/* Shop Information Section */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
            <h3 className="font-bold text-[#17202A] text-base mb-4 flex items-center gap-2">
              <span>🏪</span> ข้อมูลร้านค้าทั่วไป
            </h3>

            <form onSubmit={handleSaveShop} className="space-y-4 max-w-2xl">
              <Field label="ชื่อร้านค้า" required>
                <Input
                  value={shop.name}
                  onChange={(e) => setShop({ ...shop, name: e.target.value })}
                  placeholder="เช่น ร้านกาแฟคอฟฟี่มี"
                  required
                />
              </Field>

              <Field label="เบอร์โทรศัพท์ติดต่อ">
                <Input
                  value={shop.phone || ""}
                  onChange={(e) => setShop({ ...shop, phone: e.target.value })}
                  placeholder="เช่น 081-234-5678"
                />
              </Field>

              <Field label="ที่อยู่ร้าน">
                <Textarea
                  value={shop.address || ""}
                  onChange={(e) => setShop({ ...shop, address: e.target.value })}
                  placeholder="ระบุที่อยู่ของร้าน..."
                  rows={3}
                />
              </Field>

              <div>
                <button
                  type="submit"
                  disabled={savingShop}
                  className="rounded-xl bg-[#2563EB] px-6 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition disabled:opacity-50"
                >
                  {savingShop ? "กำลังบันทึก..." : "บันทึกข้อมูลร้านค้า"}
                </button>
              </div>
            </form>
          </div>

          {/* Payment Methods Section */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-[#17202A] text-base flex items-center gap-2">
                  <span>💳</span> ช่องทางการรับเงิน (Payment Methods)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เช่น เงินสด, โอน, คนละครึ่ง, Grab, LINE MAN, Shopee
                </p>
              </div>
              <button
                onClick={() => setShowMethodModal(true)}
                className="rounded-xl border border-blue-600 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 transition"
              >
                + เพิ่มช่องทาง
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {paymentMethods.map((pm) => (
                <div
                  key={pm.id}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3"
                >
                  <span className="text-sm font-semibold text-slate-800">{pm.name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditMethodItem(pm);
                        setEditMethodName(pm.name);
                      }}
                      className="text-xs text-slate-400 hover:text-[#2563EB] p-1 rounded-md hover:bg-blue-50 transition cursor-pointer"
                      title="แก้ไขชื่อช่องทางนี้"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeletePaymentMethod(pm.id, pm.name)}
                      className="text-xs text-slate-400 hover:text-red-600 p-1 rounded-md hover:bg-red-50 transition cursor-pointer"
                      title="ลบช่องทางนี้"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Expense Categories Section */}
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-[#17202A] text-base flex items-center gap-2">
                  <span>🏷️</span> หมวดหมู่รายจ่าย (Expense Categories)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  แยกตามประเภท: ต้นทุนสินค้า (เข้า Stock), ค่าใช้จ่ายดำเนินงาน, อุปกรณ์
                </p>
              </div>
              <button
                onClick={() => setShowCatModal(true)}
                className="rounded-xl border border-blue-600 bg-white px-3.5 py-1.5 text-xs font-semibold text-[#2563EB] hover:bg-blue-50 transition cursor-pointer"
              >
                + เพิ่มหมวดหมู่
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3.5"
                >
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{c.name}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {c.type === "cost_of_goods" && "📦 ต้นทุนสินค้า (เข้าสต็อก)"}
                      {c.type === "operating" && "🏢 ค่าใช้จ่ายดำเนินงาน"}
                      {c.type === "equipment" && "🛠️ อุปกรณ์"}
                      {c.type === "other" && "อื่นๆ"}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditCatItem(c);
                        setEditCatName(c.name);
                        setEditCatType(c.type || "operating");
                      }}
                      className="text-xs text-slate-400 hover:text-[#2563EB] p-1.5 rounded-md hover:bg-blue-50 transition cursor-pointer"
                      title="แก้ไขหมวดหมู่นี้"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(c.id, c.name)}
                      className="text-xs text-slate-400 hover:text-red-600 p-1.5 rounded-md hover:bg-red-50 transition cursor-pointer"
                      title="ลบหมวดหมู่นี้"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add Payment Method Modal */}
      {showMethodModal && (
        <Modal
          title="เพิ่มช่องทางการรับเงิน"
          onClose={() => setShowMethodModal(false)}
          onSubmit={handleAddPaymentMethod}
          submitLabel="บันทึก"
        >
          <Field label="ชื่อช่องทางรับเงิน" required>
            <Input
              placeholder="เช่น Robinhood, TikTok Shop, QR แม่มณี"
              value={methodName}
              onChange={(e) => setMethodName(e.target.value)}
              required
            />
          </Field>
        </Modal>
      )}

      {/* Edit Payment Method Modal */}
      {editMethodItem && (
        <Modal
          title="แก้ไขช่องทางการรับเงิน"
          onClose={() => setEditMethodItem(null)}
          onSubmit={handleEditPaymentMethod}
          submitLabel="บันทึกการแก้ไข"
        >
          <Field label="ชื่อช่องทางรับเงิน" required>
            <Input
              placeholder="เช่น เงินสด, โอน, Grab"
              value={editMethodName}
              onChange={(e) => setEditMethodName(e.target.value)}
              required
            />
          </Field>
        </Modal>
      )}

      {/* Add Category Modal */}
      {showCatModal && (
        <Modal
          title="เพิ่มหมวดหมู่ค่าใช้จ่าย"
          onClose={() => setShowCatModal(false)}
          onSubmit={handleAddCategory}
          submitLabel="บันทึก"
        >
          <Field label="ชื่อหมวดหมู่" required>
            <Input
              placeholder="เช่น ค่าโฆษณา Facebook, ค่าบรรจุภัณฑ์"
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              required
            />
          </Field>

          <Field label="ประเภททางบัญชี" required>
            <Select value={catType} onChange={(e) => setCatType(e.target.value)}>
              <option value="operating">ค่าใช้จ่ายดำเนินงาน (Operating)</option>
              <option value="cost_of_goods">ต้นทุนสินค้าสำหรับขาย (เข้า Stock)</option>
              <option value="equipment">อุปกรณ์ (Equipment)</option>
              <option value="other">อื่นๆ (Other)</option>
            </Select>
          </Field>
        </Modal>
      )}

      {/* Edit Category Modal */}
      {editCatItem && (
        <Modal
          title="แก้ไขหมวดหมู่ค่าใช้จ่าย"
          onClose={() => setEditCatItem(null)}
          onSubmit={handleEditCategory}
          submitLabel="บันทึกการแก้ไข"
        >
          <Field label="ชื่อหมวดหมู่" required>
            <Input
              placeholder="เช่น ค่าโฆษณา Facebook, ค่าบรรจุภัณฑ์"
              value={editCatName}
              onChange={(e) => setEditCatName(e.target.value)}
              required
            />
          </Field>

          <Field label="ประเภททางบัญชี" required>
            <Select value={editCatType} onChange={(e) => setEditCatType(e.target.value)}>
              <option value="operating">ค่าใช้จ่ายดำเนินงาน (Operating)</option>
              <option value="cost_of_goods">ต้นทุนสินค้าสำหรับขาย (เข้า Stock)</option>
              <option value="equipment">อุปกรณ์ (Equipment)</option>
              <option value="other">อื่นๆ (Other)</option>
            </Select>
          </Field>
        </Modal>
      )}
    </div>
  );
}
