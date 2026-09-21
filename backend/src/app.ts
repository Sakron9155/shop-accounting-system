import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { apiRoutes } from './api/routes/index.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(env.apiPrefix, apiRoutes);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'finance-backend' });
  });

  return app;
}
