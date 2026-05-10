// Fastify server assembly and CLI entrypoint.

import { Client } from '@elastic/elasticsearch';
import Fastify, { type FastifyInstance } from 'fastify';
import mysql from 'mysql2/promise';
import { loadConfig } from '../shared/config.js';
import { getLogger } from '../shared/logger.js';
import { correlationIdPlugin } from './plugins/correlationId.js';
import { errorHandlerPlugin } from './plugins/errorHandler.js';
import { categoriesRoute } from './routes/categories.js';
import { healthRoute } from './routes/health.js';
import { productsRoute } from './routes/products.js';
import { createCatalogService, type CatalogService } from './services/catalog.js';
import { createSearchService, type SearchService } from './services/search.js';

export type ServerDeps = {
  catalog: CatalogService;
  search: SearchService;
  logLevel?: string;
};

export async function buildServer(
  deps: ServerDeps,
): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: { level: deps.logLevel ?? 'info' },
    disableRequestLogging: false,
  });

  await fastify.register(correlationIdPlugin);
  await fastify.register(errorHandlerPlugin);
  await fastify.register(healthRoute);
  await fastify.register(categoriesRoute({ catalog: deps.catalog }));
  await fastify.register(
    productsRoute({ catalog: deps.catalog, search: deps.search }),
  );

  return fastify;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = getLogger(config.LOG_LEVEL);

  const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    connectionLimit: 10,
    waitForConnections: true,
  });
  const esClient = new Client({ node: config.ES_NODE });

  const catalog = createCatalogService(pool);
  const search = createSearchService(esClient);

  const server = await buildServer({
    catalog,
    search,
    logLevel: config.LOG_LEVEL,
  });

  const shutdown = async () => {
    logger.info('shutting down');
    await server.close().catch(() => undefined);
    await pool.end().catch(() => undefined);
    await esClient.close().catch(() => undefined);
  };
  process.on('SIGINT', () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.on('SIGTERM', () => {
    void shutdown().finally(() => process.exit(0));
  });

  await server.listen({ host: '0.0.0.0', port: config.API_PORT });
  logger.info({ port: config.API_PORT }, 'api listening');
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith('/dist/api/server.js'));

if (isMain) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
