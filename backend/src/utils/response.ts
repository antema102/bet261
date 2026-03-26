import { Response } from "express";
import { ApiResponse } from "../types";

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string,
): void {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  error: unknown,
  statusCode = 500,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const body: ApiResponse = { success: false, error: message };
  res.status(statusCode).json(body);
}
