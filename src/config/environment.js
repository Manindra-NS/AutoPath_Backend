import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) 
    : ['http://localhost:5173', 'http://127.0.0.1:5173'],

  // Database Fallback setting (defaults to true so server starts even if PostgreSQL daemon is offline)
  allowMemoryFallback: process.env.ALLOW_MEMORY_FALLBACK !== 'false',
  
  // Database Configuration
  db: {
    connectionString: process.env.DATABASE_URL || null,
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'autopath',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    max: parseInt(process.env.DB_MAX_CONNECTIONS, 10) || 20,
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT_MS, 10) || 30000,
    connectionTimeoutMillis: 5000
  },

  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'autopath_super_secret_jwt_key_2026_kolkata_routes',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },

  // Default Admin Seed
  admin: {
    username: process.env.ADMIN_DEFAULT_USERNAME || 'admin',
    email: process.env.ADMIN_DEFAULT_EMAIL || 'admin@autopath.kolkata.in',
    password: process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@AutoPath2026'
  }
};

