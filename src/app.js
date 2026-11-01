import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/environment.js';
import { requestLogger } from './middleware/requestLogger.js';
import { notFoundHandler, errorHandler } from './middleware/errorMiddleware.js';
import { serveSwagger, setupSwagger, swaggerSpec } from './docs/swagger.js';

import stopRoutes from './routes/stopRoutes.js';
import routeRoutes from './routes/routeRoutes.js';
import locationRoutes from './routes/locationRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();

// Security Headers with relaxed policy for Swagger UI
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// Cross-Origin Resource Sharing (CORS) Configuration
const allowedOrigins = config.corsOrigins;
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        // In local development, permit any localhost / 127.0.0.1 port
        if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        callback(new Error(`CORS blocked request from origin: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization']
  })
);

// Body Parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request Logger
if (config.nodeEnv !== 'test') {
  app.use(requestLogger);
}

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'autopath-backend',
    version: '1.0.0'
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'autopath-backend',
    version: '1.0.0'
  });
});

// Swagger OpenAPI Documentation
app.use('/api/docs', serveSwagger, setupSwagger);
app.use('/docs', serveSwagger, setupSwagger);
app.get('/api/docs.json', (req, res) => res.json(swaggerSpec));

// Mount REST API Endpoints
// Both /api/stops and /api/stands are mapped to stopRoutes for 100% frontend compatibility
app.use('/api/stops', stopRoutes);
app.use('/api/stands', stopRoutes);

app.use('/api/routes', routeRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/admin', adminRoutes);

// Root landing endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AutoPath Backend API',
    description: 'Shared Auto-Rickshaw Transit Discovery for Kolkata',
    documentation: '/api/docs',
    health: '/api/health',
    version: '1.0.0'
  });
});

// Centralized 404 & Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

