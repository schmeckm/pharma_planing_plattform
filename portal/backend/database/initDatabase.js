import { Sequelize } from 'sequelize';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createSequelize() {
  if (process.env.DATABASE_URL) {
    return new Sequelize(process.env.DATABASE_URL, { logging: false });
  }

  const dialect = process.env.DATABASE_DIALECT || 'sqlite';
  if (dialect === 'sqlite') {
    const storage = process.env.DATABASE_STORAGE || path.join(__dirname, '..', 'data', 'portal.sqlite');
    fs.mkdirSync(path.dirname(storage), { recursive: true });
    return new Sequelize({ dialect: 'sqlite', storage, logging: false });
  }

  return new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'portal',
    username: process.env.DB_USER || 'portal',
    password: process.env.DB_PASSWORD || 'portal',
    logging: false,
  });
}

export const sequelize = createSequelize();

export async function initDatabase() {
  const { defineModels } = await import('../models/index.js');
  defineModels(sequelize);
  await sequelize.sync();
  const { runMigrations } = await import('./migrate.js');
  await runMigrations();
}
