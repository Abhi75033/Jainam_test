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
import { auditTrail } from '@/middlewares/auditTrail';
import { swaggerSpec } from '@/config/swagger';
import { generateOpenApiPaths } from '@/config/openapiPaths';
import { registerRoutes } from '@/routes';
import packageJson from '../package.json';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
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
  app.use(auditTrail); // §4.4: blanket audit net over every mutating request

  app.get('/health', (_req, res) => {
    return res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        message: 'JiNANAM API is running smoothly',
        version: packageJson.version,
        deployedAt: new Date().toISOString(),
        environment: env.NODE_ENV,
      },
    });
  });

  registerRoutes(app);

  // Auto-generate OpenAPI paths from the live router so every endpoint is documented (§1)
  (swaggerSpec as any).paths = { ...generateOpenApiPaths(app), ...((swaggerSpec as any).paths ?? {}) };

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/docs.json', (_req, res) => res.json(swaggerSpec));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
