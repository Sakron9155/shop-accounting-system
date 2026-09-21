import { Router } from 'express';
import type { PoolClient } from 'pg';
import { pool, query } from '../../db/pool.js';

export const expensesRoutes = Router();

// GET /api/expenses
expensesRoutes.get('/', async (req, res) => {
  try {
    const { startDate, endDate, categoryId, search, limit = '100', offset = '0' } = req.query;
    let sql = `
      SELECT e.*, ec.name as category_name, ec.type as category_type
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (startDate) {
      params.push(startDate);
      sql += ` AND e.date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND e.date <= $${params.length}`;
    }
    if (categoryId) {
      params.push(parseInt(categoryId as string));
      sql += ` AND e.expense_category_id = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND e.description ILIKE $${params.length}`;
    }

    sql += ` ORDER BY e.date DESC, e.created_at DESC`;
    params.push(parseInt(limit as string) || 100);
    sql += ` LIMIT $${params.length}`;
    params.push(parseInt(offset as string) || 0);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    // Summary by category type — use parameterized query to prevent SQL injection
    const summaryParams: unknown[] = [];
    let summarySql = `
      SELECT ec.type as category_type, COALESCE(SUM(e.amount), 0) as total
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
      WHERE 1=1
    `;
    if (startDate) {
      summaryParams.push(startDate);
      summarySql += ` AND e.date >= $${summaryParams.length}`;
    }
    if (endDate) {
      summaryParams.push(endDate);
      summarySql += ` AND e.date <= $${summaryParams.length}`;
    }
    summarySql += ` GROUP BY ec.type`;
    const summaryRes = await query(summarySql, summaryParams);

    const summary: Record<string, number> = {};
    for (const row of summaryRes.rows) {
      summary[row.category_type ?? 'other'] = Number(row.total);
    }

    res.json({ items: result.rows, summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/expenses/:id
expensesRoutes.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const expRes = await query(
      `SELECT e.*, ec.name as category_name, ec.type as category_type
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
       WHERE e.id = $1`,
      [id],
    );
    if (!expRes.rows.length) return res.status(404).json({ error: 'Not found' });

    const itemsRes = await query(
      `SELECT ei.*, p.name as product_name, p.code as product_code, p.unit
       FROM expense_items ei
       LEFT JOIN products p ON p.id = ei.product_id
       WHERE ei.expense_id = $1`,
      [id],
    );

    res.json({ ...expRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper to process batch expense creation within an existing pg client transaction
async function processBatchExpenses(
  client: PoolClient,
  data: { date: string; notes?: string; note?: string; items: any[] },
) {
  const { date, notes, note, items } = data;

  if (!date) {
    throw new Error('กรุณาระบุวันที่');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('กรุณาระบุรายการรายจ่ายอย่างน้อย 1 รายการ');
  }

  // Fetch all active categories for ID and type resolution
  const catRes = await client.query(
    'SELECT id, name, type FROM expense_categories WHERE is_active = TRUE',
  );
  const categoriesById = new Map<number, { id: number; name: string; type: string }>();
  const categoriesByType = new Map<string, { id: number; name: string; type: string }>();

  for (const c of catRes.rows) {
    categoriesById.set(c.id, c);
    if (!categoriesByType.has(c.type)) {
      categoriesByType.set(c.type, c);
    }
  }

  const overallNote = (notes ?? note ?? '').trim();
  const createdIds: number[] = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemNum = i + 1;

    if (!item.description || !item.description.trim()) {
      throw new Error(`รายการที่ ${itemNum}: กรุณาระบุชื่อรายการ/คำอธิบาย`);
    }

    const amount = Number(item.amount);
    if (isNaN(amount) || amount <= 0) {
      throw new Error(`รายการที่ ${itemNum}: จำนวนเงินต้องมากกว่า 0`);
    }

    // Resolve category
    let categoryId: number | null = null;
    let categoryType = 'other';

    if (item.expense_category_id && categoriesById.has(Number(item.expense_category_id))) {
      const cat = categoriesById.get(Number(item.expense_category_id))!;
      categoryId = cat.id;
      categoryType = cat.type;
    } else if (item.category) {
      let typeKey = item.category;
      if (typeKey === 'operating_expense') typeKey = 'operating';
      if (categoriesByType.has(typeKey)) {
        const cat = categoriesByType.get(typeKey)!;
        categoryId = cat.id;
        categoryType = cat.type;
      }
    }

    const itemNote = item.notes?.trim() || overallNote;

    // Insert expense
    const expRes = await client.query<{ id: number }>(
      `INSERT INTO expenses (date, description, amount, expense_category_id, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [date, item.description.trim(), amount, categoryId, itemNote],
    );
    const expenseId = expRes.rows[0].id;

    if (categoryType === 'cost_of_goods') {
      const productId = item.product_id ? Number(item.product_id) : null;
      if (!productId) {
        throw new Error(`รายการที่ ${itemNum}: กรุณาเลือกสินค้าสำหรับรายการต้นทุนสินค้า`);
      }
      const qty = parseInt(item.quantity);
      if (!qty || qty <= 0) {
        throw new Error(`รายการที่ ${itemNum}: จำนวนสินค้าต้องมากกว่า 0`);
      }

      const unitPrice =
        item.unit_price != null && !isNaN(Number(item.unit_price)) && Number(item.unit_price) >= 0
          ? Number(item.unit_price)
          : amount / qty;

      // Lock product row
      const prodRes = await client.query<{ id: number; name: string; quantity: number; cost_price: number }>(
        'SELECT id, name, quantity, cost_price FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
        [productId],
      );
      if (!prodRes.rows.length) {
        throw new Error(`รายการที่ ${itemNum}: ไม่พบสินค้าที่เลือก (ID: ${productId})`);
      }

      const prod = prodRes.rows[0];
      const before = prod.quantity;
      const after = before + qty;

      // Weighted average cost
      const oldCost = Number(prod.cost_price);
      const weightedAvg =
        before === 0
          ? unitPrice
          : (oldCost * before + unitPrice * qty) / (before + qty);

      // Insert expense_items
      await client.query(
        `INSERT INTO expense_items (expense_id, product_id, item_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [expenseId, productId, prod.name, qty, unitPrice],
      );

      // Update product stock and cost price
      await client.query(
        'UPDATE products SET quantity = $1, cost_price = $2, updated_at = NOW() WHERE id = $3',
        [after, weightedAvg, productId],
      );

      // Insert stock_movements
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
         VALUES ($1, 'PURCHASE', $2, $3, $4, 'expense', $5, $6)`,
        [productId, qty, before, after, expenseId, `ซื้อสินค้า: ${item.description.trim()}`],
      );
    } else if (categoryType === 'equipment') {
      const qty = parseInt(item.quantity) || 1;
      const unitPrice =
        item.unit_price != null && !isNaN(Number(item.unit_price))
          ? Number(item.unit_price)
          : amount / qty;

      await client.query(
        `INSERT INTO expense_items (expense_id, product_id, item_name, quantity, unit_price)
         VALUES ($1, NULL, $2, $3, $4)`,
        [expenseId, item.description.trim(), qty, unitPrice],
      );
    }

    createdIds.push(expenseId);
  }

  return createdIds;
}

// POST /api/expenses/batch — Batch create multiple expenses in an atomic transaction
expensesRoutes.post('/batch', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const createdIds = await processBatchExpenses(client, req.body);
    await client.query('COMMIT');

    const result = await query(
      `SELECT e.*, ec.name as category_name, ec.type as category_type
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
       WHERE e.id = ANY($1::int[])
       ORDER BY e.id ASC`,
      [createdIds],
    );

    res.status(201).json({ count: createdIds.length, items: result.rows });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(400).json({ error: err.message || 'เกิดข้อผิดพลาดในการบันทึกรายจ่าย' });
  } finally {
    client.release();
  }
});

// POST /api/expenses — with optional stock increase for cost_of_goods or batch support
expensesRoutes.post('/', async (req, res) => {
  // If batch payload sent to POST /
  if (Array.isArray(req.body.items) && (!req.body.description || req.body.amount == null)) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const createdIds = await processBatchExpenses(client, req.body);
      await client.query('COMMIT');

      const result = await query(
        `SELECT e.*, ec.name as category_name, ec.type as category_type
         FROM expenses e
         LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
         WHERE e.id = ANY($1::int[])
         ORDER BY e.id ASC`,
        [createdIds],
      );
      return res.status(201).json({ count: createdIds.length, items: result.rows });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(err);
      return res.status(400).json({ error: err.message || 'เกิดข้อผิดพลาดในการบันทึกรายจ่าย' });
    } finally {
      client.release();
    }
  }

  const { date, description, amount, expense_category_id, notes, items } = req.body;

  if (!date || !description?.trim() || !amount)
    return res.status(400).json({ error: 'date, description, amount are required' });
  if (Number(amount) < 0)
    return res.status(400).json({ error: 'Amount cannot be negative' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get category type
    let categoryType = 'other';
    if (expense_category_id) {
      const catRes = await client.query<{ type: string }>(
        'SELECT type FROM expense_categories WHERE id = $1',
        [expense_category_id],
      );
      if (catRes.rows.length) categoryType = catRes.rows[0].type;
    }

    // Insert expense
    const expRes = await client.query<{ id: number }>(
      `INSERT INTO expenses (date, description, amount, expense_category_id, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [date, description.trim(), Number(amount), expense_category_id || null, notes ?? ''],
    );
    const expenseId = expRes.rows[0].id;

    // If cost_of_goods and items provided → increase stock
    if (categoryType === 'cost_of_goods' && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const { product_id, item_name, quantity, unit_price } = item;
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) throw new Error('Quantity must be > 0');

        // Insert expense_item
        await client.query(
          `INSERT INTO expense_items (expense_id, product_id, item_name, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [expenseId, product_id || null, item_name ?? '', qty, Number(unit_price) || 0],
        );

        // If linked to a product → increase stock
        if (product_id) {
          const prodRes = await client.query<{ quantity: number; cost_price: number }>(
            'SELECT quantity, cost_price FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
            [product_id],
          );
          if (prodRes.rows.length) {
            const before = prodRes.rows[0].quantity;
            const after = before + qty;

            // Update cost_price with weighted average
            const oldCost = Number(prodRes.rows[0].cost_price);
            const newUnitPrice = Number(unit_price) || 0;
            const weightedAvg =
              before === 0
                ? newUnitPrice
                : (oldCost * before + newUnitPrice * qty) / (before + qty);

            await client.query(
              'UPDATE products SET quantity = $1, cost_price = $2, updated_at = NOW() WHERE id = $3',
              [after, weightedAvg, product_id],
            );

            await client.query(
              `INSERT INTO stock_movements (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
               VALUES ($1, 'PURCHASE', $2, $3, $4, 'expense', $5, $6)`,
              [product_id, qty, before, after, expenseId, `ซื้อสินค้า: ${description}`],
            );
          }
        }
      }
    } else if (categoryType === 'equipment' && Array.isArray(items) && items.length > 0) {
      // Equipment items — NO stock increase
      for (const item of items) {
        const { item_name, quantity, unit_price } = item;
        const qty = parseInt(quantity);
        await client.query(
          `INSERT INTO expense_items (expense_id, product_id, item_name, quantity, unit_price)
           VALUES ($1, NULL, $2, $3, $4)`,
          [expenseId, item_name ?? '', qty || 1, Number(unit_price) || 0],
        );
      }
    }

    await client.query('COMMIT');

    const result = await query(
      `SELECT e.*, ec.name as category_name, ec.type as category_type
       FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
       WHERE e.id = $1`,
      [expenseId],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.message?.includes('Quantity')) return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/expenses/:id — Full transaction with stock reversal + re-apply
expensesRoutes.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { date, description, amount, expense_category_id, notes, items } = req.body;
  if (!date || !description?.trim() || amount == null)
    return res.status(400).json({ error: 'date, description, amount are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock and fetch current expense
    const expRes = await client.query<{ expense_category_id: number | null }>(
      'SELECT expense_category_id FROM expenses WHERE id = $1 FOR UPDATE',
      [id],
    );
    if (!expRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }

    const oldCategoryId = expRes.rows[0].expense_category_id;

    // 2. Resolve old category type
    let oldCategoryType = 'other';
    if (oldCategoryId) {
      const catRes = await client.query<{ type: string }>(
        'SELECT type FROM expense_categories WHERE id = $1',
        [oldCategoryId],
      );
      if (catRes.rows.length) oldCategoryType = catRes.rows[0].type;
    }

    // 3. Reverse stock for old cost_of_goods items
    if (oldCategoryType === 'cost_of_goods') {
      const oldItemsRes = await client.query<{ product_id: number | null; quantity: number }>(
        'SELECT product_id, quantity FROM expense_items WHERE expense_id = $1',
        [id],
      );
      for (const item of oldItemsRes.rows) {
        if (!item.product_id) continue;
        const prodRes = await client.query<{ quantity: number }>(
          'SELECT quantity FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id],
        );
        if (prodRes.rows.length) {
          const before = prodRes.rows[0].quantity;
          const after = Math.max(0, before - item.quantity);
          await client.query(
            'UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2',
            [after, item.product_id],
          );
          await client.query(
            `INSERT INTO stock_movements (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
             VALUES ($1, 'ADJUSTMENT', $2, $3, $4, 'expense_edit', $5, 'แก้ไขรายการซื้อสินค้า (คืนสต็อกเดิม)')`,
            [item.product_id, -item.quantity, before, after, id],
          );
        }
      }
    }

    // 4. Delete old expense_items
    await client.query('DELETE FROM expense_items WHERE expense_id = $1', [id]);

    // 5. Resolve new category type
    let newCategoryType = 'other';
    if (expense_category_id) {
      const catRes = await client.query<{ type: string }>(
        'SELECT type FROM expense_categories WHERE id = $1',
        [expense_category_id],
      );
      if (catRes.rows.length) newCategoryType = catRes.rows[0].type;
    }

    // 6. Update expense record
    await client.query(
      `UPDATE expenses SET date=$1, description=$2, amount=$3, expense_category_id=$4, notes=$5, updated_at=NOW()
       WHERE id=$6`,
      [date, description.trim(), Number(amount), expense_category_id || null, notes ?? '', id],
    );

    // 7. Insert new items + update stock
    if (newCategoryType === 'cost_of_goods' && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const { product_id, item_name, quantity, unit_price } = item;
        const qty = parseInt(quantity);
        if (!qty || qty <= 0) throw new Error('Quantity must be > 0');
        const unitPriceNum = Number(unit_price) || 0;

        await client.query(
          `INSERT INTO expense_items (expense_id, product_id, item_name, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, product_id || null, item_name ?? '', qty, unitPriceNum],
        );

        if (product_id) {
          const prodRes = await client.query<{ quantity: number; cost_price: number }>(
            'SELECT quantity, cost_price FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
            [product_id],
          );
          if (prodRes.rows.length) {
            const before = prodRes.rows[0].quantity;
            const after = before + qty;
            const oldCost = Number(prodRes.rows[0].cost_price);
            const weightedAvg =
              before === 0
                ? unitPriceNum
                : (oldCost * before + unitPriceNum * qty) / (before + qty);

            await client.query(
              'UPDATE products SET quantity = $1, cost_price = $2, updated_at = NOW() WHERE id = $3',
              [after, weightedAvg, product_id],
            );
            await client.query(
              `INSERT INTO stock_movements (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
               VALUES ($1, 'PURCHASE', $2, $3, $4, 'expense_edit', $5, 'แก้ไขรายการซื้อสินค้า (เพิ่มสต็อกใหม่)')`,
              [product_id, qty, before, after, id],
            );
          }
        }
      }
    } else if (newCategoryType === 'equipment' && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const { item_name, quantity, unit_price } = item;
        const qty = parseInt(quantity) || 1;
        await client.query(
          `INSERT INTO expense_items (expense_id, product_id, item_name, quantity, unit_price)
           VALUES ($1, NULL, $2, $3, $4)`,
          [id, item_name ?? '', qty, Number(unit_price) || 0],
        );
      }
    }

    await client.query('COMMIT');

    const result = await query(
      `SELECT e.*, ec.name as category_name, ec.type as category_type
       FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
       WHERE e.id = $1`,
      [id],
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/expenses/:id
expensesRoutes.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check category type — if cost_of_goods, reverse stock
    const expRes = await client.query<{ expense_category_id: number }>(
      'SELECT expense_category_id FROM expenses WHERE id = $1',
      [id],
    );
    if (!expRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }

    const catRes = expRes.rows[0].expense_category_id
      ? await client.query<{ type: string }>(
          'SELECT type FROM expense_categories WHERE id = $1',
          [expRes.rows[0].expense_category_id],
        )
      : null;

    if (catRes?.rows[0]?.type === 'cost_of_goods') {
      const itemsRes = await client.query<{ product_id: number | null; quantity: number }>(
        'SELECT product_id, quantity FROM expense_items WHERE expense_id = $1',
        [id],
      );
      for (const item of itemsRes.rows) {
        if (!item.product_id) continue;
        const prodRes = await client.query<{ quantity: number }>(
          'SELECT quantity FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id],
        );
        if (prodRes.rows.length) {
          const before = prodRes.rows[0].quantity;
          const after = Math.max(0, before - item.quantity);
          await client.query(
            'UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2',
            [after, item.product_id],
          );
          await client.query(
            `INSERT INTO stock_movements (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
             VALUES ($1, 'ADJUSTMENT', $2, $3, $4, 'expense_delete', $5, 'ยกเลิกการซื้อสินค้า')`,
            [item.product_id, -item.quantity, before, after, id],
          );
        }
      }
    }

    await client.query('DELETE FROM expenses WHERE id = $1', [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
