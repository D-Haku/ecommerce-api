// Fastify plugin that attaches a correlation id to each request.

import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    correlationId: string;
  }
}

export const correlationIdPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const incoming = request.headers['x-correlation-id'];
    const id =
      typeof incoming === 'string' && incoming.length > 0
        ? incoming
        : randomUUID();
    request.correlationId = id;
    reply.header('x-correlation-id', id);
  });
};
