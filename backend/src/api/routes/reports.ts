import { Router } from 'express';
import { query } from '../../db/pool.js';

export const reportsRoutes = Router();

// GET /api/reports/summary?period=&startDate=&endDate=
reportsRoutes.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json({ error: 'startDate and endDate are required' });

    const [incomeRes, expenseRes] = await Promise.all([
      query(
        `SELECT 
          COALESCE(SUM(amount), 0) as total_income,
          COALESCE(SUM(cost_of_goods), 0) as total_cogs,
          COUNT(*) as income_count
         FROM income
         WHERE date >= $1 AND date <= $2`,
        [startDate, endDate],
      ),
      query(
        `SELECT 
          COALESCE(SUM(e.amount), 0) as total_expense,
          COALESCE(SUM(CASE WHEN ec.type = 'cost_of_goods' THEN e.amount ELSE 0 END), 0) as cost_of_goods,
          COALESCE(SUM(CASE WHEN ec.type = 'operating' THEN e.amount ELSE 0 END), 0) as operating,
          COALESCE(SUM(CASE WHEN ec.type = 'equipment' THEN e.amount ELSE 0 END), 0) as equipment,
          COALESCE(SUM(CASE WHEN ec.type = 'other' OR ec.type IS NULL THEN e.amount ELSE 0 END), 0) as other_expense,
          COUNT(*) as expense_count
         FROM expenses e
         LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
         WHERE e.date >= $1 AND e.date <= $2`,
        [startDate, endDate],
      ),
    ]);

    const totalIncome = Number(incomeRes.rows[0].total_income);
    const totalCogs = Number(incomeRes.rows[0].total_cogs);
    const totalExpense = Number(expenseRes.rows[0].total_expense);
    const operatingExpense = Number(expenseRes.rows[0].operating);
    const equipmentExpense = Number(expenseRes.rows[0].equipment);

    const grossProfit = totalIncome - totalCogs;
    const operatingProfit = grossProfit - operatingExpense;
    const netProfit = totalIncome - totalCogs - totalExpense;
    const grossMargin = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;
    const netMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    res.json({
      period: { start: startDate, end: endDate },
      income: {
        total: totalIncome,
        cogs: totalCogs,
        count: Number(incomeRes.rows[0].income_count),
      },
      expense: {
        total: totalExpense,
        costOfGoods: Number(expenseRes.rows[0].cost_of_goods),
        operating: operatingExpense,
        equipment: equipmentExpense,
        other: Number(expenseRes.rows[0].other_expense),
        count: Number(expenseRes.rows[0].expense_count),
      },
      profit: {
        grossProfit,
        operatingProfit,
        netProfit,
        grossMargin: Number(grossMargin.toFixed(2)),
        netMargin: Number(netMargin.toFixed(2)),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/income?startDate=&endDate=&groupBy=day|month
reportsRoutes.get('/income', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json({ error: 'startDate and endDate are required' });

    const groupExpr = groupBy === 'month' ? `TO_CHAR(date, 'YYYY-MM')` : `date::text`;

    const result = await query(
      `SELECT 
        ${groupExpr} as period,
        COALESCE(SUM(amount), 0) as total,
        COALESCE(SUM(cost_of_goods), 0) as cogs,
        COUNT(*) as count
       FROM income
       WHERE date >= $1 AND date <= $2
       GROUP BY period ORDER BY period`,
      [startDate, endDate],
    );

    // Channel breakdown
    const channelRes = await query(
      `SELECT pm.name as channel, COALESCE(SUM(i.amount), 0) as total
       FROM income i LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
       WHERE i.date >= $1 AND i.date <= $2
       GROUP BY pm.name ORDER BY total DESC`,
      [startDate, endDate],
    );

    res.json({ items: result.rows, byChannel: channelRes.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/expense?startDate=&endDate=&groupBy=day|month
reportsRoutes.get('/expense', async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    if (!startDate || !endDate)
      return res.status(400).json({ error: 'startDate and endDate are required' });

    const groupExpr = groupBy === 'month' ? `TO_CHAR(e.date, 'YYYY-MM')` : `e.date::text`;

    const result = await query(
      `SELECT 
        ${groupExpr} as period,
        ec.name as category_name,
        ec.type as category_type,
        COALESCE(SUM(e.amount), 0) as total,
        COUNT(*) as count
       FROM expenses e
       LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
       WHERE e.date >= $1 AND e.date <= $2
       GROUP BY period, ec.name, ec.type ORDER BY period, ec.name`,
      [startDate, endDate],
    );

    res.json({ items: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/reports/stock
reportsRoutes.get('/stock', async (_req, res) => {
  try {
    const result = await query(`
      SELECT 
        p.*,
        p.quantity * p.cost_price as stock_value,
        COALESCE((SELECT SUM(sm.quantity) FILTER (WHERE sm.type = 'PURCHASE') FROM stock_movements sm WHERE sm.product_id = p.id), 0) as total_purchased,
        COALESCE((SELECT SUM(ABS(sm.quantity)) FILTER (WHERE sm.type = 'SALE') FROM stock_movements sm WHERE sm.product_id = p.id), 0) as total_sold
      FROM products p
      WHERE p.is_active = TRUE
      ORDER BY p.code
    `);

    const totalValue = result.rows.reduce(
      (sum: number, p: any) => sum + Number(p.stock_value),
      0,
    );

    res.json({ items: result.rows, totalStockValue: totalValue });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});
