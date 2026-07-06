import { NextFunction, Request, Response } from 'express';
import { recordAudit, auditContextFromRequest, CRITICAL_ACTIONS } from '@/engines/audit/audit.service';
import { logger } from '@/config/logger';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const SKIP_PATH_PREFIXES = ['/api/v1/auth/otp', '/api/v1/auth/login', '/api/v1/auth/refresh'];
const SENSITIVE_KEYS = /password|otp|aadhaar|pan|token|secret|proof/i;

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEYS.test(key) ? '[REDACTED]' : value;
  }
  return out;
}

function moduleFromPath(path: string): string {
  // /api/v1/<module>/... -> MODULE
  const segment = path.split('/')[3] ?? 'unknown';
  return segment.replace(/-/g, '_').toUpperCase();
}

/**
 * Automatic middleware-level audit for every mutating action (§4.4). Registered
 * globally; fires on response finish so req.actor (set later by requireAuth in
 * the route chain) is available. Controllers still record richer audits with
 * before/after diffs for critical actions — this blanket net guarantees no
 * successful mutation escapes the trail. Failures are logged, never thrown.
 */
export function auditTrail(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (SKIP_PATH_PREFIXES.some((p) => req.path.startsWith(p))) return next();

  res.on('finish', () => {
    if (res.statusCode >= 400) return; // only successful mutations
    if (!req.actor) return; // unauthenticated endpoints handle their own logging

    const action = req.method;
    recordAudit({
      ...auditContextFromRequest(req),
      organizationId:
        (req.params?.organizationId as string | undefined) ??
        (req.body?.organizationId as string | undefined),
      module: moduleFromPath(req.originalUrl),
      action: `HTTP_${action}`,
      entityType: 'HttpRequest',
      entityId: req.originalUrl.slice(0, 500),
      after: sanitizeBody(req.body),
      isCritical: CRITICAL_ACTIONS.has(action),
    }).catch((err) => logger.warn({ err, path: req.originalUrl }, 'audit trail write failed'));
  });

  next();
}
