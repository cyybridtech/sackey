import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { createAuditLog } from '../middleware/audit.middleware';

/**
 * POST /api/auth/login
 * Authenticate a user and return a JWT.
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { username } });

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ success: false, error: 'Invalid credentials' });
      return;
    }

    const secret = process.env.JWT_SECRET || 'pos-default-jwt-secret-key-2026';
    const token = jwt.sign(
      { userId: user.id, role: user.role, name: user.name },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    // Audit log
    await createAuditLog(user.id, 'LOGIN', 'User', user.id, null, null, req.ip);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          username: user.username,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
        },
      },
      message: 'Login successful',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 * Return the currently authenticated user's info.
 */
export const getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true, role: true, isActive: true, mustChangePassword: true, createdAt: true },
    });

    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/change-password
 * Change the current user's password after verifying the old one.
 */
export const changePassword = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Current and new passwords are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash, mustChangePassword: false } });

    await createAuditLog(userId, 'CHANGE_PASSWORD', 'User', userId, null, null, req.ip);

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/setup-credentials
 * First-time login / credentials setup: worker updates username and password.
 */
export const setupCredentials = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { newUsername, newPassword } = req.body;
    const userId = req.user!.userId;

    if (!newUsername || !newPassword) {
      res.status(400).json({ success: false, error: 'New username and new password are required' });
      return;
    }

    if (newUsername.trim().length < 3) {
      res.status(400).json({ success: false, error: 'Username must be at least 3 characters' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Check if newUsername is taken by another user
    const usernameOwner = await prisma.user.findUnique({ where: { username: newUsername.trim() } });
    if (usernameOwner && usernameOwner.id !== userId) {
      res.status(409).json({ success: false, error: 'Username is already taken by another account' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: newUsername.trim(),
        passwordHash,
        mustChangePassword: false,
      },
      select: {
        id: true,
        name: true,
        username: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
      },
    });

    const secret = process.env.JWT_SECRET || 'pos-default-jwt-secret-key-2026';
    const token = jwt.sign(
      { userId: updatedUser.id, role: updatedUser.role, name: updatedUser.name },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' } as jwt.SignOptions
    );

    await createAuditLog(userId, 'SETUP_CREDENTIALS', 'User', userId, null, updatedUser, req.ip);

    res.json({
      success: true,
      data: {
        token,
        user: updatedUser,
      },
      message: 'Credentials updated successfully',
    });
  } catch (err) {
    next(err);
  }
};
