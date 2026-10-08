import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Route imports
import authRoutes from './routes/auth.routes';
import productRoutes from './routes/products.routes';
import customerRoutes from './routes/customers.routes';
import salesRoutes from './routes/sales.routes';
import creditsRoutes from './routes/credits.routes';
import adminRoutes from './routes/admin.routes';
import smsRoutes from './routes/sms.routes';
import prisma from './lib/prisma';

const app = express();

// ─── Security & Logging ───────────────────────────────────────────────────────
app.use(helmet());
app.use(morgan('dev'));

// ─── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((url) => url.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in deployment with credentials handled
    },
    credentials: true,
  })
);

// ─── Body Parser ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Static Files ────────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/credits', creditsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sms', smsRoutes);

// Direct aliases for serverless rewrites
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/customers', customerRoutes);
app.use('/sales', salesRoutes);
app.use('/credits', creditsRoutes);
app.use('/admin', adminRoutes);
app.use('/sms', smsRoutes);

// ─── Health Check & Diagnostics ──────────────────────────────────────────────
app.get(['/api/health', '/health'], async (_req, res) => {
  try {
    const userCount = await prisma.user.count();
    res.json({
      success: true,
      message: 'POS API is running',
      database: 'connected',
      usersInDb: userCount,
      env: {
        hasDbUrl: Boolean(process.env.DATABASE_URL),
        hasJwtSecret: Boolean(process.env.JWT_SECRET),
        nodeEnv: process.env.NODE_ENV,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: err.message,
      env: {
        hasDbUrl: Boolean(process.env.DATABASE_URL),
        hasJwtSecret: Boolean(process.env.JWT_SECRET),
        nodeEnv: process.env.NODE_ENV,
      },
    });
  }
});

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global Error:', err);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

export default app;
