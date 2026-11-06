export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 404, "NOT_FOUND", details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class SlotUnavailableError extends AppError {
  constructor(message = "Requested slot is outside host availability or has already passed.", details?: unknown) {
    super(message, 409, "SLOT_UNAVAILABLE", details);
  }
}

export class SlotConflictError extends AppError {
  constructor(message = "The requested time slot is already booked or overlaps with an existing reservation.", details?: unknown) {
    super(message, 409, "SLOT_CONFLICT", details);
  }
}

export class IdempotencyConflictError extends AppError {
  constructor(message = "Idempotency-Key was previously used with different request parameters.", details?: unknown) {
    super(message, 409, "IDEMPOTENCY_CONFLICT", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized to perform this action.", details?: unknown) {
    super(message, 403, "UNAUTHORIZED", details);
  }
}

export class InvalidStateTransitionError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "INVALID_STATE_TRANSITION", details);
  }
}

export function formatErrorResponse(error: unknown): { status: number; body: { error: { message: string; code: string; details?: unknown } } } {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: {
          message: error.message,
          code: error.code,
          ...(error.details !== undefined ? { details: error.details } : {}),
        },
      },
    };
  }

  // Handle PostgreSQL exclusion constraint violations (23P01)
  if (typeof error === "object" && error !== null && "code" in error && (error as { code: string }).code === "23P01") {
    return {
      status: 409,
      body: {
        error: {
          message: "The requested time slot is already booked or overlaps with an existing reservation.",
          code: "SLOT_CONFLICT",
        },
      },
    };
  }

  const message = error instanceof Error ? error.message : "An unexpected server error occurred.";
  return {
    status: 500,
    body: {
      error: {
        message,
        code: "INTERNAL_SERVER_ERROR",
      },
    },
  };
}

