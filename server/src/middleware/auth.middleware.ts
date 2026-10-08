import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { JwtPayload, Role } from '../types';

/**
 * Authentication middleware.
 * Extracts and verifies a Bearer JWT from the Authorization header.
 * Attaches the decoded payload to req.user on success.
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    next(new Error('Authentication service is not configured'));
    return;
  }

  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  if (
    typeof decoded === 'string' ||
    typeof decoded.userId !== 'number' ||
    typeof decoded.name !== 'string' ||
    !Object.values(Role).includes(decoded.role as Role)
  ) {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { name: true, role: true, isActive: true },
    });
    if (!user || !user.isActive || user.role !== decoded.role) {
      res.status(401).json({ success: false, error: 'Invalid or expired token' });
      return;
    }

    req.user = { userId: decoded.userId, name: user.name, role: user.role } satisfies JwtPayload;
    next();
  } catch (err) {
    next(err);
  }
};
