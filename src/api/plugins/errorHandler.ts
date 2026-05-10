// Fastify error handler plugin that produces a uniform JSON error envelope.

import type {
  FastifyError,
  FastifyPluginAsync,
  FastifyReply,
  FastifyRequest,
} from 'fastify';
import {
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from '../../shared/errors.js';

export type ErrorResponse = {
  status: number;
  body: { message: string; correlationId?: string };
  contentType: 'application/json';
};

type ErrorContext = {
  correlationId?: string;
};

function isConnectionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const anyErr = err as { code?: string; name?: string };
  const code = anyErr.code ?? '';
  const name = anyErr.name ?? '';
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ER_ACCESS_DENIED_ERROR' ||
    name === 'ConnectionError' ||
    name === 'NoLivingConnectionsError'
  );
}

export function errorToResponse(
  err: unknown,
  ctx: ErrorContext = {},
): ErrorResponse {
  if (err instanceof ValidationError) {
    return {
      status: 400,
      body: { message: err.message },
      contentType: 'application/json',
    };
  }
  if (err instanceof NotFoundError) {
    return {
      status: 404,
      body: { message: err.message },
      contentType: 'application/json',
    };
  }
  if (err instanceof ServiceUnavailableError) {
    return {
      status: 503,
      body: { message: err.message },
      contentType: 'application/json',
    };
  }
  // Fastify validation error
  const maybeFastify = err as FastifyError;
  if (maybeFastify?.validation) {
    const message =
      typeof maybeFastify.message === 'string'
        ? maybeFastify.message
        : 'invalid request';
    return {
      status: 400,
      body: { message },
      contentType: 'application/json',
    };
  }
  if (maybeFastify?.statusCode === 404) {
    return {
      status: 404,
      body: { message: maybeFastify.message ?? 'not found' },
      contentType: 'application/json',
    };
  }
  if (isConnectionError(err)) {
    return {
      status: 503,
      body: {
        message: 'upstream dependency unreachable',
      },
      contentType: 'application/json',
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  const body: { message: string; correlationId?: string } = {
    message: 'internal server error',
  };
  if (ctx.correlationId) {
    body.correlationId = ctx.correlationId;
  }
  // Surface original error message in the log, not the body.
  void message;
  return {
    status: 500,
    body,
    contentType: 'application/json',
  };
}

export const errorHandlerPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.setErrorHandler(
    (err: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const correlationId = request.correlationId;
      const response = errorToResponse(err, { correlationId });
      if (response.status >= 500) {
        const stack = err instanceof Error ? err.stack ?? err.message : String(err);
        process.stderr.write(
          `[500] correlationId=${correlationId ?? '-'} ${stack}\n`,
        );
        request.log.error(
          { correlationId, err: err instanceof Error ? err.message : String(err) },
          'unhandled error',
        );
      } else {
        request.log.info(
          {
            correlationId,
            status: response.status,
            err: err instanceof Error ? err.message : String(err),
          },
          'request error',
        );
      }
      reply
        .status(response.status)
        .header('content-type', response.contentType)
        .send(response.body);
    },
  );
};
