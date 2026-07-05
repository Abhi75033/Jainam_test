import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@/config/logger';

/**
 * /visitors namespace — realtime live-visitors dashboard for org admins (§5.11).
 * Clients join room `org:{organizationId}` to receive check-in/check-out events.
 */
export function registerVisitorsNamespace(io: SocketIOServer) {
  const ns = io.of('/visitors');

  ns.on('connection', (socket) => {
    const actor = (socket.data as any).actor;
    logger.debug({ socketId: socket.id }, 'visitors namespace connected');

    socket.on('subscribe:org', (organizationId: string) => {
      if (actor?.isSuperAdmin || actor?.organizationIds?.includes(organizationId)) {
        socket.join(`org:${organizationId}`);
      }
    });

    socket.on('disconnect', () => logger.debug({ socketId: socket.id }, 'visitors namespace disconnected'));
  });
}
