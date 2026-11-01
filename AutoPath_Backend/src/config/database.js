import pg from 'pg';
import { newDb } from 'pg-mem';
import { config } from './environment.js';

const { Pool } = pg;

let pool = null;
let memoryDb = null;
let isInMemory = false;

function createPgPool() {
  const poolConfig = config.db.connectionString
    ? {
        connectionString: config.db.connectionString,
        ssl: config.db.ssl,
        max: config.db.max,
        idleTimeoutMillis: config.db.idleTimeoutMillis,
        connectionTimeoutMillis: 2000
      }
    : {
        host: config.db.host,
        port: config.db.port,
        user: config.db.user,
        password: config.db.password,
        database: config.db.database,
        ssl: config.db.ssl,
        max: config.db.max,
        idleTimeoutMillis: config.db.idleTimeoutMillis,
        connectionTimeoutMillis: 2000
      };

  return new Pool(poolConfig);
}

/**
 * Initializes in-memory PostgreSQL instance using pg-mem.
 * Useful for automated tests and standalone development when local PG is not running.
 */
export function initInMemoryDb() {
  memoryDb = newDb();
  
  // Register necessary mock functions for pg-mem
  memoryDb.public.registerFunction({
    name: 'current_timestamp',
    args: [],
    returns: memoryDb.public.getType('timestamp with time zone'),
    implementation: () => new Date()
  });

  isInMemory = true;
  const adapter = memoryDb.adapters.createPg();
  pool = new adapter.Pool();
  console.log('⚡ [Database] Initialized in-memory PostgreSQL adapter (pg-mem).');
  return pool;
}

/**
 * Get or initialize the active database pool.
 */
export function getPool() {
  if (!pool) {
    pool = createPgPool();
  }
  return pool;
}

/**
 * Executes a query with parameters using the active database pool.
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export async function query(text, params = []) {
  const activePool = getPool();
  return activePool.query(text, params);
}

/**
 * Acquires a client from the pool for manual transaction management.
 * @returns {Promise<pg.PoolClient>}
 */
export async function getClient() {
  const activePool = getPool();
  return activePool.connect();
}

/**
 * Executes a callback within a managed transaction.
 * Automatically runs BEGIN, COMMIT on success, or ROLLBACK on error.
 * @param {Function} callback - Async function receiving (client)
 * @returns {Promise<any>}
 */
export async function transaction(callback) {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Tests the database connection.
 * If connecting to PostgreSQL fails and we are in test mode or PG is unavailable,
 * seamlessly falls back to in-memory PostgreSQL so the developer experience is friction-free.
 */
export async function checkConnection() {
  try {
    const testPool = getPool();
    const res = await testPool.query('SELECT 1 as connected');
    return { connected: true, inMemory: isInMemory };
  } catch (err) {
    if (config.allowMemoryFallback || process.env.NODE_ENV === 'test' || process.env.USE_MEMORY_DB === 'true') {
      const target = config.db.connectionString || `${config.db.host}:${config.db.port}`;
      console.warn(`⚠️ [Database] Live PostgreSQL not reachable at ${target}.`);
      console.warn('⚡ [Database] Auto-starting built-in in-memory PostgreSQL engine (pg-mem).');
      console.warn('🌱 [Database] Running migrations & seeding initial Kolkata auto routes...');
      
      initInMemoryDb();
      const { runSeeds } = await import('../../database/seed.js');
      await runSeeds();
      return { connected: true, inMemory: true };
    }
    throw err;
  }
}

/**
 * Closes the database pool.
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    isInMemory = false;
  }
}

export { pool, isInMemory };

