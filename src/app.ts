import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import pinoHttp from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { requestId } from '@/middlewares/requestId';
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler';
import { globalRateLimiter } from '@/middlewares/rateLimit';
import { swaggerSpec } from '@/config/swagger';
import { registerRoutes } from '@/routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as any).id,
      autoLogging: env.NODE_ENV !== 'test',
    }),
  );
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') }));
  app.use(compression());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use('/static', express.static(path.resolve(env.STORAGE_LOCAL_ROOT)));
  app.use(globalRateLimiter);

  app.get('/health', (_req, res) => res.status(200).json({ success: true, data: { status: 'ok' } }));

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  registerRoutes(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
