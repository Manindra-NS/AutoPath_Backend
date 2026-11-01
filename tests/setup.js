import { initInMemoryDb } from '../src/config/database.js';
import { runSeeds } from '../database/seed.js';
import { adminLogin } from '../src/services/adminService.js';
import { config } from '../src/config/environment.js';

let isSetup = false;
let cachedToken = null;

export async function setupTestEnvironment() {
  if (isSetup) {
    return { token: cachedToken };
  }

  process.env.NODE_ENV = 'test';
  process.env.USE_MEMORY_DB = 'true';

  // Initialize in-memory PostgreSQL engine for ultra-fast, isolated testing
  initInMemoryDb();

  // Run database migrations and seed data
  await runSeeds();

  // Obtain admin authentication token for tests
  const authRes = await adminLogin(config.admin.username, config.admin.password);
  cachedToken = authRes.token;
  isSetup = true;

  return { token: cachedToken };
}

