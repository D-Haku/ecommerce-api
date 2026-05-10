import { buildServer } from '../../../src/api/server.js';
import type { CatalogService } from '../../../src/api/services/catalog.js';
import type { SearchService } from '../../../src/api/services/search.js';

export async function buildTestServer(deps: {
  catalog: CatalogService;
  search: SearchService;
}) {
  return buildServer({
    catalog: deps.catalog,
    search: deps.search,
    logLevel: 'silent',
  });
}
