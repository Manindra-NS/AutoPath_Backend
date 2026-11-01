import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, checkConnection, closePool } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
  console.log('🔄 [Migration] Running database schema migrations...');
  await checkConnection();

  const migrationFile = path.join(__dirname, 'migrations', '001_init_schema.sql');
  const sql = fs.readFileSync(migrationFile, 'utf8');

  // Execute migration SQL
  await query(sql);
  console.log('✅ [Migration] Schema migration completed successfully: 001_init_schema.sql');
}

// If executed directly from CLI: npm run migrate
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(async () => {
      await closePool();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error('❌ Migration failed:', err);
      await closePool();
      process.exit(1);
    });
}

