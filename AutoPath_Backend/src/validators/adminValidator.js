import { ApiError } from '../middleware/errorMiddleware.js';

/**
 * Validates admin login input.
 */
export function validateLogin(req, res, next) {
  try {
    const { username, email, password } = req.body;
    const identifier = username || email;

    if (!identifier || typeof identifier !== 'string' || !identifier.trim()) {
      throw new ApiError('Username or email is required.', 400);
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      throw new ApiError('Password is required.', 400);
    }

    req.validatedAuth = {
      identifier: identifier.trim(),
      password: password.trim()
    };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Validates admin registration input.
 */
export function validateRegister(req, res, next) {
  try {
    const { username, email, password, role } = req.body;

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      throw new ApiError('Username is required and must be at least 3 characters.', 400);
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new ApiError('A valid email address is required.', 400);
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new ApiError('Password must be at least 6 characters.', 400);
    }

    req.validatedAdmin = {
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password: password.trim(),
      role: role || 'admin'
    };
    next();
  } catch (err) {
    next(err);
  }
}

