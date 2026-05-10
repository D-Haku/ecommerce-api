// Elasticsearch-backed search service for products.

import type { Client } from '@elastic/elasticsearch';
import { INDEX_NAME } from '../../ingest/elasticsearch.js';
import type {
  Paginated,
  ProductSummary,
} from '../../shared/types.js';

export type SearchOpts = {
  query: string;
  category?: string;
  page: number;
  pageSize: number;
};

export interface SearchService {
  searchProducts(opts: SearchOpts): Promise<Paginated<ProductSummary>>;
}

export type SearchBody = {
  from: number;
  size: number;
  query: {
    bool: {
      must: Array<{
        multi_match: {
          query: string;
          fields: string[];
        };
      }>;
      filter?: Array<{ term: { category: string } }>;
    };
  };
};

export function buildSearchBody(opts: SearchOpts): SearchBody {
  const from = (opts.page - 1) * opts.pageSize;
  const body: SearchBody = {
    from,
    size: opts.pageSize,
    query: {
      bool: {
        must: [
          {
            multi_match: {
              query: opts.query,
              fields: ['title^3', 'brand^2', 'tags^2', 'description'],
            },
          },
        ],
      },
    },
  };
  if (typeof opts.category === 'string' && opts.category.trim().length > 0) {
    body.query.bool.filter = [
      { term: { category: opts.category.trim().toLowerCase() } },
    ];
  }
  return body;
}

type Hit = {
  _id?: string;
  _score?: number | null;
  _source?: {
    id?: number;
    title?: string;
    description?: string;
    price?: number;
    category?: string;
    brand?: string | null;
    stock?: number;
    rating?: number;
    thumbnail?: string;
  };
};

type SearchResponse = {
  hits: {
    total: { value: number } | number;
    hits: Hit[];
  };
};

function hitToSummary(hit: Hit): ProductSummary {
  const src = hit._source ?? {};
  return {
    id: Number(src.id ?? (hit._id !== undefined ? Number(hit._id) : 0)),
    title: src.title ?? '',
    description: src.description ?? '',
    price: Number(src.price ?? 0),
    category: src.category ?? '',
    brand: src.brand === undefined ? null : src.brand,
    stock: Number(src.stock ?? 0),
    rating: Number(src.rating ?? 0),
    thumbnail: src.thumbnail ?? '',
  };
}

export function createSearchService(client: Client): SearchService {
  return {
    async searchProducts(opts) {
      const body = buildSearchBody(opts);
      const response = (await client.search({
        index: INDEX_NAME,
        ...body,
      })) as unknown as SearchResponse;
      const hits = response.hits.hits ?? [];
      const total =
        typeof response.hits.total === 'number'
          ? response.hits.total
          : response.hits.total.value;
      return {
        data: hits.map(hitToSummary),
        total,
        page: opts.page,
        page_size: opts.pageSize,
      };
    },
  };
}
