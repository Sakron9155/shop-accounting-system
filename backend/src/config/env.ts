import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  apiPrefix: process.env.API_PREFIX ?? '/api',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:8443',
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://postgres:Sakron46!@localhost:5432/shop_db',
};
