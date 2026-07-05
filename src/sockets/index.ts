import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '@/config/env';
import { logger } from '@/config/logger';
import { verifyAccessToken } from '@/engines/rbac/jwt.service';
import { registerTrackingNamespace } from './tracking.namespace';
import { registerDashboardsNamespace } from './dashboards.namespace';
import { registerVisitorsNamespace } from './visitors.namespace';

let io: SocketIOServer | undefined;

export function getIO(): SocketIOServer {
  if (!io) throw new Error('Socket.IO not initialized yet');
  return io;
}

function socketAuthMiddleware(socket: Socket, next: (err?: Error) => void) {
  try {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      (socket.handshake.headers.authorization?.toString().replace('Bearer ', '') as string | undefined);
    if (!token) return next(new Error('Unauthorized: missing token'));
    const payload = verifyAccessToken(token);
    (socket.data as any).actor = payload;
    next();
  } catch {
    next(new Error('Unauthorized: invalid token'));
  }
}

export function initSockets(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',') },
  });

  io.use(socketAuthMiddleware);

  registerTrackingNamespace(io);
  registerDashboardsNamespace(io);
  registerVisitorsNamespace(io);

  logger.info('Socket.IO initialized with namespaces: /tracking, /dashboards, /visitors');
  return io;
}
