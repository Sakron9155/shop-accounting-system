import { Router } from 'express';
import pg from 'pg';
import { pool, query } from '../../db/pool.js';

export const productsRoutes = Router();

// GET /api/products
productsRoutes.get('/', async (req, res) => {
  try {
    const { search, lowStock, category } = req.query;
    let sql = `SELECT * FROM products WHERE is_active = TRUE`;
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (name ILIKE $${params.length} OR code ILIKE $${params.length})`;
    }
    if (category) {
      params.push(category);
      sql += ` AND category = $${params.length}`;
    }
    if (lowStock === 'true') {
      sql += ` AND quantity <= low_stock_alert`;
    }
    sql += ` ORDER BY code`;

    const result = await query(sql, params);
    const totalValue = result.rows.reduce(
      (sum: number, p: any) =>
        sum + Number(p.quantity) * Number(p.cost_price),
      0,
    );
    res.json({ items: result.rows, totalStockValue: totalValue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/:id
productsRoutes.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const result = await query('SELECT * FROM products WHERE id = $1 AND is_active = TRUE', [id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/products
productsRoutes.post('/', async (req, res) => {
  const { code, name, category, unit, cost_price, sell_price, quantity, low_stock_alert } = req.body;
  if (!name?.trim()) {
    return res.status(400).json({ error: 'กรุณาระบุชื่อสินค้า' });
  }

  const trimmedName = name.trim();

  try {
    // 1. Duplicate check by name
    const dupRes = await query(
      `SELECT id, code, name, category, unit, quantity, cost_price, sell_price 
       FROM products 
       WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND is_active = TRUE`,
      [trimmedName],
    );
    if (dupRes.rows.length > 0) {
      return res.status(409).json({
        error: `มีสินค้าชื่อ "${dupRes.rows[0].name}" อยู่ในระบบแล้ว`,
        existingProduct: dupRes.rows[0],
      });
    }

    // 2. Auto-generate code if not provided
    let productCode = code?.trim();
    if (!productCode) {
      const lastCodeRes = await query(`
        SELECT code FROM products 
        WHERE code ~ '^P[0-9]+$' 
        ORDER BY CAST(SUBSTRING(code FROM 2) AS INTEGER) DESC 
        LIMIT 1
      `);
      let nextNum = 1;
      if (lastCodeRes.rows.length > 0) {
        const match = lastCodeRes.rows[0].code.match(/^P(\d+)$/);
        if (match) {
          nextNum = parseInt(match[1], 10) + 1;
        }
      } else {
        const countRes = await query(`SELECT COUNT(*) FROM products`);
        nextNum = parseInt(countRes.rows[0].count, 10) + 1;
      }
      productCode = 'P' + String(nextNum).padStart(3, '0');
    }

    const result = await query(
      `INSERT INTO products (code, name, category, unit, cost_price, sell_price, quantity, low_stock_alert)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        productCode,
        trimmedName,
        category?.trim() || null,
        unit?.trim() || 'ชิ้น',
        Math.max(0, Number(cost_price) || 0),
        Math.max(0, Number(sell_price) || 0),
        Math.max(0, Number(quantity) || 0),
        Number(low_stock_alert) != null && !isNaN(Number(low_stock_alert)) ? Number(low_stock_alert) : 5,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'รหัสสินค้านี้มีอยู่แล้วในระบบ' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/products/:id
productsRoutes.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { code, name, category, unit, cost_price, sell_price, low_stock_alert } = req.body;
  if (!name?.trim())
    return res.status(400).json({ error: 'กรุณาระบุชื่อสินค้า' });

  const trimmedName = name.trim();

  try {
    // Duplicate name check on other products
    const dupRes = await query(
      `SELECT id, name FROM products 
       WHERE LOWER(TRIM(name)) = LOWER(TRIM($1)) AND id != $2 AND is_active = TRUE`,
      [trimmedName, id],
    );
    if (dupRes.rows.length > 0) {
      return res.status(409).json({ error: `มีสินค้าชื่อ "${dupRes.rows[0].name}" อยู่ในระบบแล้ว` });
    }

    const result = await query(
      `UPDATE products 
       SET code=COALESCE(NULLIF($1, ''), code), 
           name=$2, 
           category=$3, 
           unit=$4, 
           cost_price=$5, 
           sell_price=$6, 
           low_stock_alert=$7, 
           updated_at=NOW()
       WHERE id=$8 AND is_active=TRUE RETURNING *`,
      [
        code?.trim() || null,
        trimmedName,
        category?.trim() || null,
        unit?.trim() || 'ชิ้น',
        Math.max(0, Number(cost_price) || 0),
        Math.max(0, Number(sell_price) || 0),
        Number(low_stock_alert) != null && !isNaN(Number(low_stock_alert)) ? Number(low_stock_alert) : 5,
        id,
      ],
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'รหัสสินค้านี้มีอยู่แล้วในระบบ' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/products/:id
productsRoutes.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    await query('UPDATE products SET is_active = FALSE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/:id/movements
productsRoutes.get('/:id/movements', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const result = await query(
      `SELECT sm.*, p.name as product_name, p.unit
       FROM stock_movements sm
       JOIN products p ON p.id = sm.product_id
       WHERE sm.product_id = $1
       ORDER BY sm.created_at DESC
       LIMIT 100`,
      [id],
    );
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/products/:id/adjust — manual stock adjustment
productsRoutes.post('/:id/adjust', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { quantity, notes } = req.body;
  const qty = parseInt(quantity);
  if (isNaN(qty)) return res.status(400).json({ error: 'Quantity must be a number' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const prodRes = await client.query<{ id: number; quantity: number }>(
      'SELECT id, quantity FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [id],
    );
    if (!prodRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const before = prodRes.rows[0].quantity;
    const after = before + qty;
    if (after < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Stock cannot be negative' });
    }

    await client.query('UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2', [
      after,
      id,
    ]);
    await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, quantity_before, quantity_after, notes)
       VALUES ($1, 'ADJUSTMENT', $2, $3, $4, $5)`,
      [id, qty, before, after, notes ?? ''],
    );

    await client.query('COMMIT');
    res.json({ success: true, quantityBefore: before, quantityAfter: after });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
