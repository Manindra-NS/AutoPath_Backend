import jwt from 'jsonwebtoken';
import { config } from '../config/environment.js';
import { ApiError } from './errorMiddleware.js';

/**
 * Authentication Middleware for Admin Endpoints
 * Verifies the JWT Bearer token supplied in the Authorization header.
 */
export function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError('Authorization token required. Please include a valid Bearer token.', 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new ApiError('Malformed Authorization header.', 401);
    }

    const decoded = jwt.verify(token, config.jwt.secret);
    req.admin = decoded;
    next();
  } catch (err) {
    if (err instanceof ApiError) {
      return next(err);
    }
    next(new ApiError('Invalid or expired authentication token.', 401));
  }
}

