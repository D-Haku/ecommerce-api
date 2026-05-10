// GET /categories route.

import type { FastifyPluginAsync } from 'fastify';
import type { CatalogService } from '../services/catalog.js';

export type CategoriesRouteDeps = {
  catalog: CatalogService;
};

export function categoriesRoute(
  deps: CategoriesRouteDeps,
): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get('/categories', async () => {
      return deps.catalog.listCategories();
    });
  };
}
