// Ingest orchestrator entrypoint.

import { Client } from '@elastic/elasticsearch';
import mysql from 'mysql2/promise';
import { loadConfig } from '../shared/config.js';
import { getLogger } from '../shared/logger.js';
import { sourceToProduct } from '../shared/mapping.js';
import type { MappedProduct } from '../shared/types.js';
import {
  bulkIndexProducts,
  ensureSearchIndex,
} from './elasticsearch.js';
import { runMigrations } from './migrations.js';
import { IngestFailure, upsertAll } from './mysql.js';
import { fetchAllProducts } from './source.js';

export async function ingest(): Promise<void> {
  const config = loadConfig();
  const logger = getLogger(config.LOG_LEVEL);
  const started = Date.now();

  const pool = mysql.createPool({
    host: config.DB_HOST,
    port: config.DB_PORT,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: config.DB_NAME,
    connectionLimit: 4,
    waitForConnections: true,
  });

  const esClient = new Client({ node: config.ES_NODE });

  try {
    await runMigrations(pool);
    await ensureSearchIndex(esClient);

    const sourceProducts = await fetchAllProducts({
      baseUrl: config.SOURCE_API_URL,
    });
    const mapped: MappedProduct[] = sourceProducts.map(sourceToProduct);

    const written = await upsertAll(pool, mapped);
    await bulkIndexProducts(esClient, mapped);

    logger.info(
      {
        totalFetched: sourceProducts.length,
        totalUpserted: written.length,
        durationMs: Date.now() - started,
      },
      'ingestion complete',
    );
  } catch (err) {
    if (err instanceof IngestFailure) {
      logger.error(
        {
          writtenIds: err.writtenIds,
          failingId: err.failingId,
          message: err.message,
        },
        'ingestion failed after partial write',
      );
    } else {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ message }, 'ingestion failed');
    }
    throw err;
  } finally {
    await pool.end().catch(() => undefined);
    await esClient.close().catch(() => undefined);
  }
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  (import.meta.url === `file://${process.argv[1]}` ||
    import.meta.url.endsWith('/dist/ingest/index.js'));

if (isMain) {
  ingest().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
