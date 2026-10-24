import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { HttpError } from './lib/errors.js';
import * as clock from './lib/clock.js';
import { requireAuth } from './auth/middleware.js';
import { authRouter } from './routes/auth.js';
import { healthRouter } from './routes/health.js';
import { demoRouter } from './routes/demo.js';
import { adminRouter } from './routes/admin.js';
import { notificationsRouter } from './routes/notifications.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173', credentials: false }));
  app.use(express.json({ limit: '1mb' }));
  app.use((_req, _res, next) => {
    if (clock.hasOverride()) return next();
    clock.refreshIfStale().then(() => next(), next);
  });

  const api = express.Router();
  api.use(healthRouter());
  api.use('/auth', authRouter());
  api.use(requireAuth);
  api.use('/demo', demoRouter());
  api.use('/admin', adminRouter());
  api.use('/notifications', notificationsRouter());
  app.use('/api', api);

  app.use((_req, res) => {
    res.status(404).json({ error: "You don't have access to this page." });
  });

  // Central error handler: never leaks stack traces.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }
    const e = err as { type?: string; code?: string; message?: string };
    if (e?.type === 'entity.too.large') {
      res.status(413).json({ error: 'The request is too large.' });
      return;
    }
    if (e?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'The request body is not valid JSON.' });
      return;
    }
    if (e?.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Files must be 10 MB or smaller.' });
      return;
    }
    console.error('[api] unhandled error', err);
    res.status(500).json({ error: 'Something went wrong on the server. Try again, and tell the help desk if it keeps happening.' });
  });

  return app;
}
