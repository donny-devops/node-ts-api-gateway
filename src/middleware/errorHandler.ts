import { NextFunction, Request, Response } from "express";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      status: err.statusCode,
      path: req.path,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // Unexpected errors — don't leak internals
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "An unexpected error occurred",
    status: 500,
    path: req.path,
    timestamp: new Date().toISOString(),
  });
}
