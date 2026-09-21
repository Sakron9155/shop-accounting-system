import { Router } from 'express';
import { pool, query } from '../../db/pool.js';

export const stockRoutes = Router();

// GET /api/stock — stock summary
stockRoutes.get('/', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        p.*,
        COALESCE((SELECT SUM(sm.quantity) FILTER (WHERE sm.type = 'PURCHASE') FROM stock_movements sm WHERE sm.product_id = p.id), 0) as total_purchased,
        COALESCE((SELECT SUM(ABS(sm.quantity)) FILTER (WHERE sm.type = 'SALE') FROM stock_movements sm WHERE sm.product_id = p.id), 0) as total_sold
      FROM products p
      WHERE p.is_active = TRUE
      ORDER BY p.code
    `);

    const totalValue = result.rows.reduce(
      (sum: number, p: any) =>
        sum + p.quantity * Number(p.cost_price),
      0,
    );
    const lowStockItems = result.rows.filter(
      (p: any) => p.quantity <= p.low_stock_alert,
    );

    res.json({
      items: result.rows,
      totalStockValue: totalValue,
      lowStockCount: lowStockItems.length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/stock/movements
stockRoutes.get('/movements', async (req, res) => {
  try {
    const { productId, type, startDate, endDate, limit = '100', offset = '0' } = req.query;
    let sql = `
      SELECT sm.*, p.name as product_name, p.code as product_code, p.unit
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (productId) {
      params.push(parseInt(productId as string));
      sql += ` AND sm.product_id = $${params.length}`;
    }
    if (type) {
      params.push(type);
      sql += ` AND sm.type = $${params.length}`;
    }
    if (startDate) {
      params.push(startDate);
      sql += ` AND sm.created_at::date >= $${params.length}`;
    }
    if (endDate) {
      params.push(endDate);
      sql += ` AND sm.created_at::date <= $${params.length}`;
    }

    sql += ` ORDER BY sm.created_at DESC`;
    params.push(parseInt(limit as string) || 100);
    sql += ` LIMIT $${params.length}`;
    params.push(parseInt(offset as string) || 0);
    sql += ` OFFSET $${params.length}`;

    const result = await query(sql, params);
    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
