import { Request, Response, NextFunction } from 'express';
import { Role } from '../types';

/**
 * Role-based authorization middleware factory.
 * Returns a middleware that only allows users whose role is in the allowed list.
 *
 * @param roles - Roles permitted to access the route
 */
export const requireRole = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: 'Access denied: insufficient permissions',
      });
      return;
    }

    next();
  };
};
