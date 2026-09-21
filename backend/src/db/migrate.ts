import pg from 'pg';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:shop12@localhost:5432/shop_db';
const url = new URL(DATABASE_URL);
const dbName = url.pathname.slice(1); // 'shop_db'

async function createDatabase() {
  // Connect to postgres (default db) to create shop_db if not exists
  const adminUrl = new URL(DATABASE_URL);
  adminUrl.pathname = '/postgres';

  const adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();

  const result = await adminClient.query(
    `SELECT 1 FROM pg_database WHERE datname = $1`,
    [dbName],
  );

  if (result.rowCount === 0) {
    await adminClient.query(`CREATE DATABASE "${dbName}"`);
    console.log(`✅ Database "${dbName}" created`);
  } else {
    console.log(`ℹ️  Database "${dbName}" already exists`);
  }

  await adminClient.end();
}

async function runMigration() {
  const schemaPath = join(__dirname, 'schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');

  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  console.log('✅ Connected to database');

  await client.query(schema);
  console.log('✅ Schema applied successfully');

  // Verify tables
  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `);
  console.log('📋 Tables created:', tables.rows.map((r: { table_name: string }) => r.table_name).join(', '));

  await client.end();
}

async function main() {
  console.log('🚀 Starting migration...');
  try {
    await createDatabase();
    await runMigration();
    console.log('🎉 Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

main();
