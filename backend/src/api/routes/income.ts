import { Router } from 'express';
import { pool, query } from '../../db/pool.js';

export const incomeRoutes = Router();

// GET /api/income
incomeRoutes.get('/', async (req, res) => {
  try {
    const { startDate, endDate, paymentMethodId, type, search, limit = '100', offset = '0' } = req.query;
    let sql = `
      SELECT i.*, pm.name as payment_method_name
      FROM income i
      LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (startDate) {
      params.push(startDate);
      sql += ` AND i.date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND i.date <= $${params.length}`;
    }
    if (paymentMethodId) {
      params.push(parseInt(paymentMethodId as string));
      sql += ` AND i.payment_method_id = $${params.length}`;
    }
    if (type) {
      params.push(type);
      sql += ` AND i.type = $${params.length}`;
    }
    if (search) {
      params.push(`%${search}%`);
      sql += ` AND i.description ILIKE $${params.length}`;
    }

    sql += ` ORDER BY i.date DESC, i.created_at DESC`;
    params.push(parseInt(limit as string) || 100);
    sql += ` LIMIT $${params.length}`;
    params.push(parseInt(offset as string) || 0);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);

    // Total summary — use parameterized query to prevent SQL injection
    const totalParams: unknown[] = [];
    let totalSql = `
      SELECT COALESCE(SUM(amount), 0) as total, COALESCE(SUM(cost_of_goods), 0) as total_cogs
      FROM income i WHERE 1=1
    `;
    if (startDate) {
      totalParams.push(startDate);
      totalSql += ` AND i.date >= $${totalParams.length}`;
    }
    if (endDate) {
      totalParams.push(endDate);
      totalSql += ` AND i.date <= $${totalParams.length}`;
    }
    const totalRes = await query(totalSql, totalParams);

    res.json({
      items: result.rows,
      total: totalRes.rows[0].total,
      totalCogs: totalRes.rows[0].total_cogs,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/income/daily-summary — ยอดรวมรายวันแยกช่องทาง
incomeRoutes.get('/daily-summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let dateFilter = '';
    const params: unknown[] = [];
    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND i.date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND i.date <= $${params.length}`;
    }

    const result = await query(`
      SELECT 
        i.date,
        pm.name as payment_method,
        SUM(i.amount) as total
      FROM income i
      LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
      WHERE 1=1 ${dateFilter}
      GROUP BY i.date, pm.name
      ORDER BY i.date DESC, pm.name
    `, params);

    // Group by date
    const byDate: Record<string, Record<string, number>> = {};
    for (const row of result.rows) {
      const date = row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date);
      if (!byDate[date]) byDate[date] = {};
      byDate[date][row.payment_method ?? 'อื่นๆ'] = Number(row.total);
    }

    const summary = Object.entries(byDate)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, channels]) => ({
        date,
        channels,
        total: Object.values(channels).reduce((s, v) => s + v, 0),
      }));

    res.json({ summary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/income/:id
incomeRoutes.get('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const incRes = await query(
      `SELECT i.*, pm.name as payment_method_name FROM income i
       LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
       WHERE i.id = $1`,
      [id],
    );
    if (!incRes.rows.length) return res.status(404).json({ error: 'Not found' });

    const itemsRes = await query(
      `SELECT ii.*, p.name as product_name, p.code as product_code, p.unit
       FROM income_items ii
       JOIN products p ON p.id = ii.product_id
       WHERE ii.income_id = $1`,
      [id],
    );

    res.json({ ...incRes.rows[0], items: itemsRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/income — General income OR Sale (with stock movement)
incomeRoutes.post('/', async (req, res) => {
  const { date, description, amount, payment_method_id, type = 'general', notes, items } = req.body;

  if (!date || !description?.trim() || !amount)
    return res.status(400).json({ error: 'date, description, amount are required' });
  if (Number(amount) < 0)
    return res.status(400).json({ error: 'Amount cannot be negative' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let totalCogs = 0;

    // If type=sale, validate and calculate COGS, reduce stock
    if (type === 'sale' && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const { product_id, quantity } = item;
        if (!product_id || !quantity || quantity <= 0)
          throw new Error('Each sale item must have product_id and quantity > 0');

        const prodRes = await client.query<{
          id: number; quantity: number; cost_price: number; name: string;
        }>(
          'SELECT id, quantity, cost_price, name FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
          [product_id],
        );

        if (!prodRes.rows.length) throw new Error(`Product id ${product_id} not found`);
        const product = prodRes.rows[0];
        if (product.quantity < quantity)
          throw new Error(`ไม่มีสินค้า "${product.name}" เพียงพอ (มี ${product.quantity} ชิ้น)`);

        totalCogs += Number(product.cost_price) * quantity;
      }
    }

    // Insert income record
    const incRes = await client.query<{ id: number }>(
      `INSERT INTO income (date, description, amount, payment_method_id, type, cost_of_goods, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [date, description.trim(), Number(amount), payment_method_id || null, type, totalCogs, notes ?? ''],
    );
    const incomeId = incRes.rows[0].id;

    // If type=sale, process each item
    if (type === 'sale' && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        const { product_id, quantity, unit_price } = item;

        const prodRes = await client.query<{
          id: number; quantity: number; cost_price: number;
        }>(
          'SELECT id, quantity, cost_price FROM products WHERE id = $1 FOR UPDATE',
          [product_id],
        );
        const product = prodRes.rows[0];
        const costPrice = Number(product.cost_price);
        const before = product.quantity;
        const after = before - quantity;

        // Insert income_items
        await client.query(
          `INSERT INTO income_items (income_id, product_id, quantity, unit_price, cost_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [incomeId, product_id, quantity, Number(unit_price) || product.cost_price, costPrice],
        );

        // Reduce stock
        await client.query(
          'UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2',
          [after, product_id],
        );

        // Stock movement
        await client.query(
          `INSERT INTO stock_movements (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
           VALUES ($1, 'SALE', $2, $3, $4, 'income', $5, $6)`,
          [product_id, -quantity, before, after, incomeId, `ขายสินค้า: ${description}`],
        );
      }
    }

    await client.query('COMMIT');

    const result = await query(
      `SELECT i.*, pm.name as payment_method_name FROM income i
       LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
       WHERE i.id = $1`,
      [incomeId],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.message?.startsWith('ไม่มีสินค้า') || err.message?.includes('not found')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// PUT /api/income/:id — update income (general or sale)
// For sale: full stock reversal + re-application in a single PostgreSQL transaction
incomeRoutes.put('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { date, description, amount, payment_method_id, notes, items } = req.body;
  if (!date || !description?.trim())
    return res.status(400).json({ error: 'date and description are required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─── Load existing income record ───
    const existingRes = await client.query<{ id: number; type: string }>(
      'SELECT id, type FROM income WHERE id = $1',
      [id],
    );
    if (!existingRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }
    const incomeType = existingRes.rows[0].type;

    // ════════════════════════════════════════════════
    // BRANCH A: General income — simple field update
    // ════════════════════════════════════════════════
    if (incomeType === 'general') {
      if (amount === undefined || amount === null)
        return res.status(400).json({ error: 'amount is required' });

      await client.query(
        `UPDATE income
         SET date=$1, description=$2, amount=$3, payment_method_id=$4, notes=$5, updated_at=NOW()
         WHERE id=$6`,
        [date, description.trim(), Number(amount), payment_method_id || null, notes ?? '', id],
      );

      await client.query('COMMIT');

      const result = await query(
        `SELECT i.*, pm.name as payment_method_name FROM income i
         LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
         WHERE i.id = $1`,
        [id],
      );
      return res.json(result.rows[0]);
    }

    // ════════════════════════════════════════════════
    // BRANCH B: Sale income — full stock reversal + re-apply
    // ════════════════════════════════════════════════
    const newItems: { product_id: number; quantity: number; unit_price: number }[] =
      Array.isArray(items) ? items : [];

    if (newItems.length === 0)
      return res.status(400).json({ error: 'Sale income must have at least one item' });

    // Validate item fields upfront
    for (const item of newItems) {
      if (!item.product_id || !item.quantity || item.quantity <= 0)
        throw new Error('Each sale item must have product_id and quantity > 0');
    }

    // ─── STEP 1: Load old income_items ───
    const oldItemsRes = await client.query<{ product_id: number; quantity: number }>(
      'SELECT product_id, quantity FROM income_items WHERE income_id = $1',
      [id],
    );
    const oldItems = oldItemsRes.rows;

    // ─── STEP 2: Collect all unique product_ids (old + new) and lock them
    //     Lock in ascending id order to prevent deadlocks
    const allProductIds = [
      ...new Set([
        ...oldItems.map((i) => i.product_id),
        ...newItems.map((i) => i.product_id),
      ]),
    ].sort((a, b) => a - b);

    const productMap = new Map<
      number,
      { id: number; quantity: number; cost_price: number; name: string }
    >();

    for (const pid of allProductIds) {
      const r = await client.query<{
        id: number;
        quantity: number;
        cost_price: number;
        name: string;
      }>(
        'SELECT id, quantity, cost_price, name FROM products WHERE id = $1 AND is_active = TRUE FOR UPDATE',
        [pid],
      );
      if (!r.rows.length) throw new Error(`Product id ${pid} not found or inactive`);
      productMap.set(pid, { ...r.rows[0] });
    }

    // ─── STEP 3: Restore stock from old sale items (in-memory + DB) ───
    for (const oldItem of oldItems) {
      const prod = productMap.get(oldItem.product_id);
      if (!prod) continue;

      const before = prod.quantity;
      const after = before + oldItem.quantity;

      await client.query(
        'UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2',
        [after, oldItem.product_id],
      );

      await client.query(
        `INSERT INTO stock_movements
           (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
         VALUES ($1, 'ADJUSTMENT', $2, $3, $4, 'income_edit_reverse', $5,
                 'คืน Stock จากการแก้ไขรายการขาย #' || $5)`,
        [oldItem.product_id, oldItem.quantity, before, after, id],
      );

      // Update in-memory map so subsequent validations see restored quantity
      prod.quantity = after;
    }

    // ─── STEP 4: Delete old income_items ───
    await client.query('DELETE FROM income_items WHERE income_id = $1', [id]);

    // ─── STEP 5: Validate new items against restored stock ───
    for (const item of newItems) {
      const prod = productMap.get(item.product_id);
      if (!prod) throw new Error(`Product id ${item.product_id} not found`);
      if (prod.quantity < item.quantity) {
        throw new Error(
          `ไม่มีสินค้า "${prod.name}" เพียงพอ (มี ${prod.quantity} ชิ้น ต้องการ ${item.quantity} ชิ้น)`,
        );
      }
    }

    // ─── STEP 6: Apply new sale items — reduce stock, record movements ───
    let totalCogs = 0;
    let totalAmount = 0;

    for (const item of newItems) {
      const prod = productMap.get(item.product_id)!;
      const costPrice = Number(prod.cost_price);
      const unitPrice = Number(item.unit_price) || costPrice;
      const before = prod.quantity;
      const after = before - item.quantity;

      // Insert income_item — snapshot cost_price at time of (edited) sale
      await client.query(
        `INSERT INTO income_items (income_id, product_id, quantity, unit_price, cost_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, item.product_id, item.quantity, unitPrice, costPrice],
      );

      // Reduce stock
      await client.query(
        'UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2',
        [after, item.product_id],
      );

      // Stock movement for new sale
      await client.query(
        `INSERT INTO stock_movements
           (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
         VALUES ($1, 'SALE', $2, $3, $4, 'income', $5, $6)`,
        [
          item.product_id,
          -item.quantity,
          before,
          after,
          id,
          `ขายสินค้า (แก้ไข): ${description.trim()}`,
        ],
      );

      totalCogs += costPrice * item.quantity;
      totalAmount += unitPrice * item.quantity;

      // Update in-memory map
      prod.quantity = after;
    }

    // ─── STEP 7: Update income record ───
    await client.query(
      `UPDATE income
       SET date=$1, description=$2, amount=$3, payment_method_id=$4,
           cost_of_goods=$5, notes=$6, updated_at=NOW()
       WHERE id=$7`,
      [
        date,
        description.trim(),
        totalAmount,
        payment_method_id || null,
        totalCogs,
        notes ?? '',
        id,
      ],
    );

    // ─── STEP 8: Commit ───
    await client.query('COMMIT');

    const result = await query(
      `SELECT i.*, pm.name as payment_method_name FROM income i
       LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
       WHERE i.id = $1`,
      [id],
    );
    return res.json(result.rows[0]);
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error(err);
    if (
      err.message?.startsWith('ไม่มีสินค้า') ||
      err.message?.includes('not found') ||
      err.message?.includes('product_id') ||
      err.message?.includes('inactive')
    ) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

// DELETE /api/income/:id
incomeRoutes.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check if it's a sale — reverse stock movements
    const incRes = await client.query<{ type: string }>(
      'SELECT type FROM income WHERE id = $1',
      [id],
    );
    if (!incRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }

    if (incRes.rows[0].type === 'sale') {
      // Get income items to reverse stock
      const itemsRes = await client.query<{ product_id: number; quantity: number }>(
        'SELECT product_id, quantity FROM income_items WHERE income_id = $1',
        [id],
      );

      for (const item of itemsRes.rows) {
        const prodRes = await client.query<{ quantity: number }>(
          'SELECT quantity FROM products WHERE id = $1 FOR UPDATE',
          [item.product_id],
        );
        if (prodRes.rows.length) {
          const before = prodRes.rows[0].quantity;
          const after = before + item.quantity;
          await client.query(
            'UPDATE products SET quantity = $1, updated_at = NOW() WHERE id = $2',
            [after, item.product_id],
          );
          await client.query(
            `INSERT INTO stock_movements (product_id, type, quantity, quantity_before, quantity_after, reference_type, reference_id, notes)
             VALUES ($1, 'ADJUSTMENT', $2, $3, $4, 'income_delete', $5, 'ยกเลิกรายการขาย')`,
            [item.product_id, item.quantity, before, after, id],
          );
        }
      }
    }

    await client.query('DELETE FROM income WHERE id = $1', [id]);
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
