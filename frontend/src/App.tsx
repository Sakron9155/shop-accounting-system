import { useState, useEffect } from "react";
import Login from "./pages/Login";
import Layout, { Page } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Income from "./pages/Income";
import Expense from "./pages/Expense";
import Products from "./pages/Products"; // Reused as Stock page
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import { fetchSettings, ShopSettings } from "./services/settings";

const pageTitles: Record<Page, string> = {
  dashboard: "Dashboard ภาพรวม",
  income: "จัดการรายรับ",
  expense: "จัดการรายจ่าย",
  stock: "จัดการ Stock สินค้า",
  reports: "รายงานทางบัญชี",
  settings: "ตั้งค่าระบบ",
};

export default function App() {
  const [loggedIn, setLoggedIn] = useState(true); // Default logged in for immediate usability or let user toggle
  const [page, setPage] = useState<Page>("dashboard");
  const [shopSettings, setShopSettings] = useState<ShopSettings | null>(null);

  const loadShopInfo = async () => {
    try {
      const data = await fetchSettings();
      if (data?.shop) {
        setShopSettings(data.shop);
      }
    } catch (err) {
      console.warn("Could not load shop info from API:", err);
    }
  };

  useEffect(() => {
    if (loggedIn) {
      loadShopInfo();
    }
  }, [loggedIn]);

  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <Layout
      page={page}
      onNavigate={setPage}
      onLogout={() => setLoggedIn(false)}
      shopName={shopSettings?.name || "ร้านค้าส่วนตัว"}
      title={pageTitles[page]}
    >
      {page === "dashboard" && <Dashboard onNavigate={(p: string) => setPage(p as Page)} />}
      {page === "income" && <Income />}
      {page === "expense" && <Expense />}
      {page === "stock" && <Products />}
      {page === "reports" && <Reports />}
      {page === "settings" && <Settings onUpdate={loadShopInfo} />}
    </Layout>
  );
}

