import { Router } from 'express';
import { query } from '../../db/pool.js';

export const settingsRoutes = Router();

// GET /api/settings
settingsRoutes.get('/', async (_req, res) => {
  try {
    const [shopRes, methodsRes, categoriesRes] = await Promise.all([
      query('SELECT * FROM shop_settings LIMIT 1'),
      query('SELECT * FROM payment_methods WHERE is_active = TRUE ORDER BY sort_order'),
      query('SELECT * FROM expense_categories WHERE is_active = TRUE ORDER BY sort_order'),
    ]);

    res.json({
      shop: shopRes.rows[0] ?? { name: 'ร้านค้าส่วนตัว', phone: '', address: '' },
      paymentMethods: methodsRes.rows,
      expenseCategories: categoriesRes.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings
settingsRoutes.put('/', async (req, res) => {
  const { name, phone, address } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Shop name is required' });

  try {
    const existing = await query('SELECT id FROM shop_settings LIMIT 1');
    if (existing.rowCount && existing.rowCount > 0) {
      await query(
        `UPDATE shop_settings SET name=$1, phone=$2, address=$3, updated_at=NOW() WHERE id=$4`,
        [name.trim(), phone ?? '', address ?? '', existing.rows[0].id],
      );
    } else {
      await query(
        `INSERT INTO shop_settings (name, phone, address) VALUES ($1, $2, $3)`,
        [name.trim(), phone ?? '', address ?? ''],
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings/payment-methods
settingsRoutes.post('/payment-methods', async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  try {
    const maxSort = await query('SELECT COALESCE(MAX(sort_order), 0) as m FROM payment_methods');
    const result = await query(
      `INSERT INTO payment_methods (name, sort_order) VALUES ($1, $2) RETURNING *`,
      [name.trim(), (maxSort.rows[0].m as number) + 1],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/payment-methods/:id
settingsRoutes.put('/payment-methods/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });

  try {
    const result = await query(
      `UPDATE payment_methods SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [name.trim(), id],
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/settings/payment-methods/:id
settingsRoutes.delete('/payment-methods/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await query('UPDATE payment_methods SET is_active = FALSE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/settings/expense-categories
settingsRoutes.post('/expense-categories', async (req, res) => {
  const { name, type } = req.body;
  const validTypes = ['cost_of_goods', 'operating', 'equipment', 'other'];
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });

  try {
    const maxSort = await query('SELECT COALESCE(MAX(sort_order), 0) as m FROM expense_categories');
    const result = await query(
      `INSERT INTO expense_categories (name, type, sort_order) VALUES ($1, $2, $3) RETURNING *`,
      [name.trim(), type, (maxSort.rows[0].m as number) + 1],
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings/expense-categories/:id
settingsRoutes.put('/expense-categories/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const { name, type } = req.body;
  const validTypes = ['cost_of_goods', 'operating', 'equipment', 'other'];
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (type && !validTypes.includes(type)) return res.status(400).json({ error: 'Invalid type' });

  try {
    let result;
    if (type) {
      result = await query(
        `UPDATE expense_categories SET name = $1, type = $2, updated_at = NOW() WHERE id = $3 RETURNING *`,
        [name.trim(), type, id],
      );
    } else {
      result = await query(
        `UPDATE expense_categories SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
        [name.trim(), id],
      );
    }
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    if (err.code === '23505') return res.status(409).json({ error: 'Name already exists' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/settings/expense-categories/:id
settingsRoutes.delete('/expense-categories/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await query('UPDATE expense_categories SET is_active = FALSE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
