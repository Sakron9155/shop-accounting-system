import { Router } from 'express';

export const apiRoutes = Router();

apiRoutes.get('/ping', (_req, res) => {
  res.json({ ok: true, message: 'Finance API is ready' });
});

apiRoutes.get('/income', (_req, res) => {
  res.json({ items: [] });
});

apiRoutes.get('/expense', (_req, res) => {
  res.json({ items: [] });
});

apiRoutes.get('/products', (_req, res) => {
  res.json({ items: [] });
});
