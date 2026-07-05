import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@/config/logger';

/**
 * /dashboards namespace — live admin/super-admin dashboard stat updates
 * (event attendance %, booking counts, donation totals, staff check-in status).
 * Clients join room `org:{organizationId}` (or `platform` for Super Admin).
 */
export function registerDashboardsNamespace(io: SocketIOServer) {
  const ns = io.of('/dashboards');

  ns.on('connection', (socket) => {
    const actor = (socket.data as any).actor;
    logger.debug({ socketId: socket.id }, 'dashboards namespace connected');

    socket.on('subscribe:org', (organizationId: string) => {
      if (actor?.isSuperAdmin || actor?.organizationIds?.includes(organizationId)) {
        socket.join(`org:${organizationId}`);
      }
    });
    socket.on('subscribe:platform', () => {
      if (actor?.isSuperAdmin) socket.join('platform');
    });

    socket.on('disconnect', () => logger.debug({ socketId: socket.id }, 'dashboards namespace disconnected'));
  });
}
