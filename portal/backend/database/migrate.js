import { sequelize } from './initDatabase.js';

async function columnExists(tableName, columnName) {
  const [rows] = await sequelize.query(`PRAGMA table_info(${tableName});`);
  return rows.some((row) => row.name === columnName);
}

async function addColumnIfMissing(tableName, columnName, definition) {
  const exists = await columnExists(tableName, columnName);
  if (!exists) {
    await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition};`);
  }
}

export async function runMigrations() {
  const dialect = sequelize.getDialect();
  if (dialect !== 'sqlite') {
    return;
  }

  await addColumnIfMissing('AuditLogs', 'entityType', 'VARCHAR(255)');
  await addColumnIfMissing('AuditLogs', 'entityId', 'VARCHAR(255)');
  await addColumnIfMissing('AuditLogs', 'UserId', 'INTEGER');
  await addColumnIfMissing('Users', 'displayName', 'VARCHAR(255)');
  await addColumnIfMissing('Users', 'googleId', 'VARCHAR(255)');
}
