import 'express';

export interface AuthenticatedActor {
  userId: string;
  publicId: string;
  role: string;
  organizationIds: string[];
  isSuperAdmin: boolean;
  permissions: Record<string, string[]>; // moduleKey -> action[]
  deviceId?: string;
}

declare global {
  namespace Express {
    interface Request {
      id: string;
      actor?: AuthenticatedActor;
    }
  }
}
