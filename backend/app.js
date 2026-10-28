import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createApi } from './routes/api.js';
import { errorHandler, notFound } from './middleware/errors.js';

export function createApp(config) {
  const app = express();
  if (config.trustProxy) app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  const configuredOrigins = config.clientUrl.split(',').map((origin) => origin.trim()).filter(Boolean);
  app.use(cors({
    origin(origin, callback) {
      const localDevelopmentOrigin = config.nodeEnv !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
      callback(null, !origin || configuredOrigins.includes(origin) || localDevelopmentOrigin);
    },
    credentials: true
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { success: false, message: 'Too many authentication attempts. Try again later.' } });
  app.use('/api/auth', authLimiter);
  app.use('/api', createApi(config));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
