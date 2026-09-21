-- =============================================
-- shop_db Schema
-- =============================================

-- 1. Shop Settings
CREATE TABLE IF NOT EXISTS shop_settings (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL DEFAULT 'ร้านค้าส่วนตัว',
  phone VARCHAR(50),
  address TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Payment Methods (income channels)
CREATE TABLE IF NOT EXISTS payment_methods (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Expense Categories
CREATE TABLE IF NOT EXISTS expense_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('cost_of_goods', 'operating', 'equipment', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Products (Stock)
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL DEFAULT 'ชิ้น',
  cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  low_stock_alert INT NOT NULL DEFAULT 5,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Income (รายรับ)
CREATE TABLE IF NOT EXISTS income (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
  payment_method_id INT REFERENCES payment_methods(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (type IN ('general', 'sale')),
  cost_of_goods NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Income Items (รายการสินค้าที่ขาย เมื่อ type='sale')
CREATE TABLE IF NOT EXISTS income_items (
  id SERIAL PRIMARY KEY,
  income_id INT NOT NULL REFERENCES income(id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- 7. Expenses (รายจ่าย)
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
  expense_category_id INT REFERENCES expense_categories(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Expense Items (รายละเอียด สำหรับ cost_of_goods และ equipment)
CREATE TABLE IF NOT EXISTS expense_items (
  id SERIAL PRIMARY KEY,
  expense_id INT NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  product_id INT REFERENCES products(id) ON DELETE SET NULL,
  item_name VARCHAR(200) NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
  subtotal NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

-- 9. Stock Movements (ประวัติการเปลี่ยนแปลง Stock)
CREATE TABLE IF NOT EXISTS stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('PURCHASE', 'SALE', 'ADJUSTMENT')),
  quantity INT NOT NULL,
  quantity_before INT NOT NULL,
  quantity_after INT NOT NULL,
  reference_type VARCHAR(50),
  reference_id INT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_income_date ON income(date);
CREATE INDEX IF NOT EXISTS idx_income_payment_method ON income(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_income_items_income ON income_items(income_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_expense ON expense_items(expense_id);

-- =============================================
-- Seed Data
-- =============================================

-- Shop settings (default)
INSERT INTO shop_settings (name, phone, address)
VALUES ('ร้านค้าส่วนตัว', '', '')
ON CONFLICT DO NOTHING;

-- Payment methods
INSERT INTO payment_methods (name, is_active, sort_order) VALUES
  ('เงินสด', TRUE, 1),
  ('โอน', TRUE, 2),
  ('คนละครึ่ง', TRUE, 3),
  ('Grab', TRUE, 4),
  ('LINE MAN', TRUE, 5),
  ('Shopee', TRUE, 6)
ON CONFLICT (name) DO NOTHING;

-- Expense categories
INSERT INTO expense_categories (name, type, is_active, sort_order) VALUES
  ('ต้นทุนสินค้า', 'cost_of_goods', TRUE, 1),
  ('ค่าใช้จ่ายดำเนินงาน', 'operating', TRUE, 2),
  ('อุปกรณ์', 'equipment', TRUE, 3)
ON CONFLICT (name) DO NOTHING;
