import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  // Debug: log the raw Authorization header so we can see what the frontend sent
  console.log('[auth middleware] Authorization header:', req.headers.authorization || 'MISSING');

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Handle Bearer undefined, Bearer null, or empty token strings
  if (token === 'undefined' || token === 'null' || !token) {
    token = null;
  }

  // If no token found, the user is not logged in
  if (!token) {
    console.warn('[auth middleware] No token found — returning 401');
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }

  try {
    // Verify the JWT token using the same secret that was used to sign it
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_intellmeet_token_key_2026_xyz');

    // Attach user info to the request so controllers can use req.user
    req.user = await User.findById(decoded.id);

    if (!req.user) {
      console.warn('[auth middleware] Token valid but user not found in DB');
      return res.status(401).json({ success: false, error: 'User no longer exists' });
    }

    console.log('[auth middleware] Authenticated user:', req.user.email);
    next();
  } catch (err) {
    console.error('[auth middleware] Token verification failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, error: 'TokenExpired', message: 'Session expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, error: 'JsonWebTokenError', message: 'Session invalid or corrupted.' });
    }
    return res.status(401).json({ success: false, error: 'Not authorized to access this route' });
  }
};
