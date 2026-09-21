import { Router } from 'express';
import { incomeRoutes } from './income.js';
import { expensesRoutes } from './expenses.js';
import { productsRoutes } from './products.js';
import { stockRoutes } from './stock.js';
import { dashboardRoutes } from './dashboard.js';
import { reportsRoutes } from './reports.js';
import { settingsRoutes } from './settings.js';

export const apiRoutes = Router();

apiRoutes.get('/ping', (_req, res) => {
  res.json({ ok: true, message: 'Finance API is ready' });
});

apiRoutes.use('/dashboard', dashboardRoutes);
apiRoutes.use('/income', incomeRoutes);
apiRoutes.use('/expenses', expensesRoutes);
apiRoutes.use('/products', productsRoutes);
apiRoutes.use('/stock', stockRoutes);
apiRoutes.use('/reports', reportsRoutes);
apiRoutes.use('/settings', settingsRoutes);
