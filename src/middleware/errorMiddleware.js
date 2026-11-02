/**
 * Custom Operational API Error
 */
export class ApiError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * 404 Route Not Found Handler
 */
export function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
}

/**
 * Centralized Error Handler Middleware
 */
export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // PostgreSQL Error Handling
  if (err.code) {
    switch (err.code) {
      case '23505': // Unique violation
        statusCode = 409;
        message = 'A record with these unique attributes already exists.';
        details = err.detail;
        break;
      case '23503': // Foreign key violation
        statusCode = 400;
        message = 'Referenced entity does not exist.';
        details = err.detail;
        break;
      case '23514': // Check constraint violation
        statusCode = 400;
        message = 'Coordinate or attribute value violates database constraints (e.g. latitude [-90, 90], longitude [-180, 180]).';
        details = err.detail;
        break;
      case '22P02': // Invalid text representation (e.g. invalid type)
        statusCode = 400;
        message = 'Invalid data format or coordinate type.';
        break;
      default:
        break;
    }
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired. Please log in again.';
  }

  // Log server errors for diagnostics
  if (statusCode >= 500) {
    console.error(`[Server Error] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    message: message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && statusCode >= 500 && { stack: err.stack })
  });
}

