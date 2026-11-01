import app from './app.js';
import { config } from './config/environment.js';
import { checkConnection, closePool } from './config/database.js';

async function startServer() {
  try {
    console.log('🔄 [AutoPath] Verifying database connection...');
    const dbStatus = await checkConnection();
    if (dbStatus.inMemory) {
      console.log('⚡ [AutoPath] Operating with in-memory PostgreSQL engine (pg-mem).');
    } else {
      console.log('✅ [AutoPath] Connected to PostgreSQL database successfully.');
    }

    const server = app.listen(config.port, () => {
      console.log(`=======================================================`);
      console.log(`🚀 AutoPath Backend Server running on port ${config.port}`);
      console.log(`📍 Environment: ${config.nodeEnv}`);
      console.log(`📖 Swagger API Docs: http://localhost:${config.port}/api/docs`);
      console.log(`🩺 Health check:     http://localhost:${config.port}/api/health`);
      console.log(`=======================================================`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${config.port} is already in use by another process.`);
        console.error(`💡 Tip: Stop any process using port ${config.port} or change PORT in AutoPath_Backend/.env`);
      } else {
        console.error(`❌ Server listener error: ${err.message || err.code || err}`);
      }
      process.exit(1);
    });

    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Gracefully shutting down AutoPath server...`);
      server.close(async () => {
        await closePool();
        console.log('🔌 Database pool closed. Server process exited cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (err) {
    console.error('❌ Failed to start AutoPath server due to database connection error:');
    const msg = err.message || (err.errors ? err.errors.map(e => e.message || e.code).join(', ') : err.code || err);
    console.error(msg);
    process.exit(1);
  }
}

startServer();

