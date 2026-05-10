// GET /products and GET /products/:id routes.

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { NotFoundError, ValidationError } from '../../shared/errors.js';
import { normalizePagination } from '../../shared/pagination.js';
import { routeProductsRequest } from '../../shared/routing.js';
import type { CatalogService } from '../services/catalog.js';
import type { SearchService } from '../services/search.js';
import {
  ProductIdParamSchema,
  ProductsListQuerySchema,
} from '../schemas/products.js';

export type ProductsRouteDeps = {
  catalog: CatalogService;
  search: SearchService;
};

type ListQuery = {
  page?: unknown;
  page_size?: unknown;
  query?: unknown;
  category?: unknown;
};

type IdParam = { id: unknown };

export function productsRoute(deps: ProductsRouteDeps): FastifyPluginAsync {
  return async (fastify) => {
    fastify.get(
      '/products',
      { schema: { querystring: ProductsListQuerySchema } },
      async (request: FastifyRequest<{ Querystring: ListQuery }>) => {
        const { page, pageSize } = normalizePagination({
          page: request.query.page,
          page_size: request.query.page_size,
        });
        const route = routeProductsRequest({
          query: request.query.query,
          category: request.query.category,
        });
        switch (route.kind) {
          case 'search':
            return deps.search.searchProducts({
              query: route.query,
              category: route.category,
              page,
              pageSize,
            });
          case 'category':
            return deps.catalog.listProductsByCategory(route.category, {
              page,
              pageSize,
            });
          case 'list':
          default:
            return deps.catalog.listProducts({ page, pageSize });
        }
      },
    );

    fastify.get(
      '/products/:id',
      { schema: { params: ProductIdParamSchema } },
      async (request: FastifyRequest<{ Params: IdParam }>) => {
        const raw = request.params.id;
        // Schema restricts `id` to a positive-integer decimal string, so
        // Number() is safe here. Belt-and-braces check retained for defence in
        // depth in case the schema is bypassed (for example in unit tests).
        const idStr = typeof raw === 'string' ? raw : '';
        if (!/^[1-9][0-9]*$/.test(idStr)) {
          throw new ValidationError('invalid id: must be a positive integer');
        }
        const id = Number(idStr);
        const product = await deps.catalog.getProductById(id);
        if (!product) {
          throw new NotFoundError(`Product ${id} not found`);
        }
        return product;
      },
    );
  };
}
