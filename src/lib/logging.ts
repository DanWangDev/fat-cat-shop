import crypto from "crypto";
import { NextResponse } from "next/server";

type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,100}$/;

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...(value.cause ? { cause: serializeValue(value.cause) } : {}),
    };
  }
  return value;
}

function writeLog(level: LogLevel, message: string, context: LogContext = {}) {
  const serializedContext: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    serializedContext[key] = serializeValue(value);
  }

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: serializedContext,
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function logInfo(message: string, context: LogContext = {}) {
  writeLog("info", message, context);
}

export function logWarn(message: string, context: LogContext = {}) {
  writeLog("warn", message, context);
}

export function logError(message: string, context: LogContext = {}) {
  writeLog("error", message, context);
}

export function getRequestId(request: Request): string {
  const inbound = request.headers.get("x-request-id")?.trim();
  if (inbound && REQUEST_ID_PATTERN.test(inbound)) {
    return inbound;
  }
  return crypto.randomUUID();
}

export function jsonWithRequestId(
  requestId: string,
  body: unknown,
  init?: ResponseInit,
) {
  const headers = new Headers(init?.headers);
  headers.set("X-Request-Id", requestId);
  return NextResponse.json(body, { ...init, headers });
}

