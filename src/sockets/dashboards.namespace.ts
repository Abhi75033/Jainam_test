import { Server as SocketIOServer } from 'socket.io';
import { logger } from '@/config/logger';

function getActiveAdminsCount(io: SocketIOServer): number {
  const ns = io.of('/dashboards');
  const sockets = Array.from(ns.sockets.values());
  const activeUserIds = new Set<string>();
  for (const s of sockets) {
    const actor = (s.data as any).actor;
    if (actor && actor.sub && ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'DHARAMSHALA_ADMIN', 'JAIN_CENTER_ADMIN', 'MONK_ADMIN'].includes(actor.role)) {
      activeUserIds.add(actor.sub);
    }
  }
  return activeUserIds.size;
}

export function registerDashboardsNamespace(io: SocketIOServer) {
  const ns = io.of('/dashboards');

  const broadcastActiveAdmins = () => {
    try {
      const count = getActiveAdminsCount(io);
      ns.to('platform').emit('admins:active-count', { count });
    } catch (err) {
      logger.error({ err }, 'Error broadcasting active admins count');
    }
  };

  ns.on('connection', (socket) => {
    const actor = (socket.data as any).actor;
    logger.debug({ socketId: socket.id }, 'dashboards namespace connected');

    // Broadcast immediately when any socket connects
    broadcastActiveAdmins();

    socket.on('subscribe:org', (organizationId: string) => {
      if (actor?.isSuperAdmin || actor?.organizationIds?.includes(organizationId)) {
        socket.join(`org:${organizationId}`);
      }
    });

    socket.on('subscribe:platform', () => {
      if (actor?.isSuperAdmin) {
        socket.join('platform');
        // Send initial count to the newly subscribed super admin
        const count = getActiveAdminsCount(io);
        socket.emit('admins:active-count', { count });
      }
    });

    socket.on('disconnect', () => {
      logger.debug({ socketId: socket.id }, 'dashboards namespace disconnected');
      // Broadcast when any socket disconnects
      broadcastActiveAdmins();
    });
  });
}
