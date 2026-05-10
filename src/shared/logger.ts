// Pino-based structured logger with correlation id support.

import pino, { type Logger } from 'pino';

let root: Logger | null = null;

export function getLogger(level: string = process.env.LOG_LEVEL ?? 'info'): Logger {
  if (root) {
    return root;
  }
  root = pino({
    level,
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
  return root;
}

export function withCorrelationId(correlationId: string): Logger {
  return getLogger().child({ correlationId });
}
