import { Router } from 'express';
import { query } from '../../db/pool.js';

export const dashboardRoutes = Router();

// Helper: build date filter SQL
function buildDateFilter(period: string, startDate?: string, endDate?: string) {
  const now = new Date();
  let start: string;
  let end: string = now.toISOString().slice(0, 10);

  switch (period) {
    case 'day':
      start = end;
      break;
    case 'week': {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      start = d.toISOString().slice(0, 10);
      break;
    }
    case 'month':
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      break;
    case 'year':
      start = `${now.getFullYear()}-01-01`;
      break;
    case 'custom':
      start = startDate ?? end;
      end = endDate ?? end;
      break;
    default:
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  return { start, end };
}

// GET /api/dashboard?period=month|week|day|year|custom&startDate=&endDate=
dashboardRoutes.get('/', async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    const { start, end } = buildDateFilter(
      period as string,
      startDate as string,
      endDate as string,
    );

    const [incomeRes, expenseRes, stockRes] = await Promise.all([
      query(
        `SELECT 
          COALESCE(SUM(amount), 0) as total_income,
          COALESCE(SUM(cost_of_goods), 0) as total_cogs
         FROM income
         WHERE date >= $1 AND date <= $2`,
        [start, end],
      ),
      query(
        `SELECT 
          COALESCE(SUM(e.amount), 0) as total_expense,
          COALESCE(SUM(CASE WHEN ec.type = 'cost_of_goods' THEN e.amount ELSE 0 END), 0) as cost_of_goods,
          COALESCE(SUM(CASE WHEN ec.type = 'operating' THEN e.amount ELSE 0 END), 0) as operating,
          COALESCE(SUM(CASE WHEN ec.type = 'equipment' THEN e.amount ELSE 0 END), 0) as equipment,
          COALESCE(SUM(CASE WHEN ec.type = 'other' OR ec.type IS NULL THEN e.amount ELSE 0 END), 0) as other_expense
         FROM expenses e
         LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
         WHERE e.date >= $1 AND e.date <= $2`,
        [start, end],
      ),
      query(
        `SELECT 
          COALESCE(SUM(quantity * cost_price), 0) as total_stock_value,
          COUNT(*) as product_count,
          COUNT(CASE WHEN quantity <= low_stock_alert THEN 1 END) as low_stock_count
         FROM products WHERE is_active = TRUE`,
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
    const netProfitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    res.json({
      period: { type: period, start, end },
      summary: {
        totalIncome,
        totalCogs,
        totalExpense,
        operatingExpense,
        equipmentExpense,
        grossProfit,
        operatingProfit,
        netProfit,
        netProfitMargin: Number(netProfitMargin.toFixed(2)),
      },
      stock: {
        totalValue: Number(stockRes.rows[0].total_stock_value),
        productCount: Number(stockRes.rows[0].product_count),
        lowStockCount: Number(stockRes.rows[0].low_stock_count),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/chart?period=month&startDate=&endDate=
dashboardRoutes.get('/chart', async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    const { start, end } = buildDateFilter(
      period as string,
      startDate as string,
      endDate as string,
    );

    // Group by week/month/day depending on period
    const groupBy =
      period === 'day'
        ? `TO_CHAR(date, 'HH24:00')`
        : period === 'week' || (period === 'custom' && startDate && endDate && dayDiff(startDate as string, endDate as string) <= 31)
        ? `TO_CHAR(date, 'DD/MM')`
        : `TO_CHAR(date, 'MM/YYYY')`;

    const [incomeChart, expenseChart] = await Promise.all([
      query(
        `SELECT ${groupBy} as label, COALESCE(SUM(amount), 0) as income, COALESCE(SUM(cost_of_goods), 0) as cogs
         FROM income WHERE date >= $1 AND date <= $2
         GROUP BY label ORDER BY MIN(date)`,
        [start, end],
      ),
      query(
        `SELECT ${groupBy} as label, COALESCE(SUM(e.amount), 0) as expense,
          COALESCE(SUM(CASE WHEN ec.type = 'operating' THEN e.amount ELSE 0 END), 0) as operating
         FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
         WHERE e.date >= $1 AND e.date <= $2
         GROUP BY label ORDER BY MIN(e.date)`,
        [start, end],
      ),
    ]);

    // Merge by label
    const labelMap: Record<string, { income: number; cogs: number; expense: number; operating: number; profit: number }> = {};
    for (const row of incomeChart.rows) {
      if (!labelMap[row.label]) labelMap[row.label] = { income: 0, cogs: 0, expense: 0, operating: 0, profit: 0 };
      labelMap[row.label].income = Number(row.income);
      labelMap[row.label].cogs = Number(row.cogs);
    }
    for (const row of expenseChart.rows) {
      if (!labelMap[row.label]) labelMap[row.label] = { income: 0, cogs: 0, expense: 0, operating: 0, profit: 0 };
      labelMap[row.label].expense = Number(row.expense);
      labelMap[row.label].operating = Number(row.operating);
    }
    for (const label of Object.keys(labelMap)) {
      const d = labelMap[label];
      d.profit = d.income - d.cogs - d.expense;
    }

    const chartData = Object.entries(labelMap).map(([label, v]) => ({ label, ...v }));

    // Recent transactions
    const [recentIncome, recentExpense] = await Promise.all([
      query(
        `SELECT i.id, i.date, i.description, i.amount, pm.name as payment_method
         FROM income i LEFT JOIN payment_methods pm ON pm.id = i.payment_method_id
         ORDER BY i.date DESC, i.created_at DESC LIMIT 5`,
      ),
      query(
        `SELECT e.id, e.date, e.description, e.amount, ec.name as category_name
         FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.expense_category_id
         ORDER BY e.date DESC, e.created_at DESC LIMIT 5`,
      ),
    ]);

    res.json({
      chart: chartData,
      recentIncome: recentIncome.rows,
      recentExpense: recentExpense.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function dayDiff(a: string, b: string): number {
  return Math.abs((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}
