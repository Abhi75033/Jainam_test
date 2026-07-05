import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@/config/logger';

/**
 * /tracking namespace — live monk journey tracking (§5.10).
 * Clients join room `route:{routeId}` or `temple:{templeId}` to receive marker updates.
 * Server-side emit points live in jobs/tracking.jobs.ts and modules/tracking/tracking.service.ts
 * via `getIO().of('/tracking').to(room).emit(...)`.
 */
export function registerTrackingNamespace(io: SocketIOServer) {
  const ns = io.of('/tracking');

  ns.on('connection', (socket) => {
    logger.debug({ socketId: socket.id }, 'tracking namespace connected');

    socket.on('subscribe:route', (routeId: string) => socket.join(`route:${routeId}`));
    socket.on('subscribe:temple', (templeId: string) => socket.join(`temple:${templeId}`));
    socket.on('unsubscribe:route', (routeId: string) => socket.leave(`route:${routeId}`));
    socket.on('unsubscribe:temple', (templeId: string) => socket.leave(`temple:${templeId}`));

    socket.on('disconnect', () => logger.debug({ socketId: socket.id }, 'tracking namespace disconnected'));
  });
}
