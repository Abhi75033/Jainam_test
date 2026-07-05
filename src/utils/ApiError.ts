export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'TENANT_SCOPE_VIOLATION'
  | 'PAYMENT_WINDOW_EXPIRED'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  TENANT_SCOPE_VIOLATION: 403,
  PAYMENT_WINDOW_EXPIRED: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  public readonly fieldErrors?: Record<string, string[]>;

  constructor(code: ErrorCode, message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.fieldErrors = fieldErrors;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static validation(fieldErrors: Record<string, string[]>, message = 'Validation failed') {
    return new ApiError('VALIDATION_ERROR', message, fieldErrors);
  }

  static unauthorized(message = 'Unauthorized') {
    return new ApiError('UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden') {
    return new ApiError('FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError('NOT_FOUND', message);
  }

  static conflict(message = 'Conflict') {
    return new ApiError('CONFLICT', message);
  }

  static tenantScope(message = 'You do not have access to this organization\'s data') {
    return new ApiError('TENANT_SCOPE_VIOLATION', message);
  }
}
