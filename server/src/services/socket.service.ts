import { Server as HttpServer } from 'http';
import { Server as SocketServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { JwtPayload, Role } from '../types';

let io: SocketServer;
const authenticatedUsers = new WeakMap<Socket, JwtPayload>();

/**
 * Initialize Socket.io with CORS.
 * Call this once at startup with the HTTP server.
 */
export const initSocket = (httpServer: HttpServer): void => {
  io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const secret = process.env.JWT_SECRET;
    if (typeof token !== 'string' || !secret) {
      next(new Error('Authentication required'));
      return;
    }

    let decoded: string | jwt.JwtPayload;
    try {
      decoded = jwt.verify(token, secret);
    } catch {
      next(new Error('Invalid or expired token'));
      return;
    }

    if (
      typeof decoded === 'string' ||
      typeof decoded.userId !== 'number' ||
      typeof decoded.name !== 'string' ||
      !Object.values(Role).includes(decoded.role as Role)
    ) {
      next(new Error('Invalid or expired token'));
      return;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, name: true, role: true, isActive: true },
      });
      if (!user || !user.isActive || user.role !== decoded.role) {
        next(new Error('Invalid or expired token'));
        return;
      }
      authenticatedUsers.set(socket, { userId: user.id, name: user.name, role: user.role });
      next();
    } catch (err) {
      console.error('Socket authentication failed:', err);
      next(new Error('Socket authentication is temporarily unavailable'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = authenticatedUsers.get(socket);
    if (!user) {
      socket.disconnect(true);
      return;
    }

    console.log(`[Socket] Client connected: ${socket.id}`);
    socket.join(`role:${user.role}`);
    socket.join(`user:${user.userId}`);
    console.log(`[Socket] ${socket.id} joined authenticated role:${user.role}`);

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};

/**
 * Returns the initialized Socket.io instance.
 * Throws if called before initSocket.
 */
export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error('Socket.io not initialized. Call initSocket() first.');
  }
  return io;
};

/**
 * Emit an event to all connected ADMIN users.
 */
export const emitToAdmin = (event: string, data: unknown): void => {
  if (!io) return;
  io.to(`role:${Role.ADMIN}`).emit(event, data);
};

/**
 * Emit an event to all users of a specific role.
 */
export const emitToRole = (role: Role, event: string, data: unknown): void => {
  if (!io) return;
  io.to(`role:${role}`).emit(event, data);
};
