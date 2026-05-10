// In-memory implementations of CatalogService and SearchService for tests.

import type {
  CatalogService,
} from '../../../src/api/services/catalog.js';
import type {
  SearchOpts,
  SearchService,
} from '../../../src/api/services/search.js';
import type {
  Category,
  Paginated,
  Pagination,
  ProductDetail,
  ProductSummary,
} from '../../../src/shared/types.js';

function toSummary(p: ProductDetail): ProductSummary {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    price: p.price,
    category: p.category,
    brand: p.brand,
    stock: p.stock,
    rating: p.rating,
    thumbnail: p.thumbnail,
  };
}

export type FakeCatalogState = {
  categories: Category[];
  products: ProductDetail[];
  calls: { name: string; args: unknown[] }[];
};

export function createFakeCatalog(state: FakeCatalogState): CatalogService {
  return {
    async listCategories() {
      state.calls.push({ name: 'listCategories', args: [] });
      return [...state.categories].sort((a, b) => a.name.localeCompare(b.name));
    },
    async listProducts(opts: Pagination): Promise<Paginated<ProductSummary>> {
      state.calls.push({ name: 'listProducts', args: [opts] });
      const sorted = [...state.products].sort((a, b) => a.id - b.id);
      const from = (opts.page - 1) * opts.pageSize;
      const slice = sorted.slice(from, from + opts.pageSize);
      return {
        data: slice.map(toSummary),
        total: sorted.length,
        page: opts.page,
        page_size: opts.pageSize,
      };
    },
    async listProductsByCategory(category, opts) {
      state.calls.push({ name: 'listProductsByCategory', args: [category, opts] });
      const lower = category.toLowerCase();
      const filtered = state.products.filter(
        (p) => p.category.toLowerCase() === lower,
      );
      const sorted = filtered.sort((a, b) => a.id - b.id);
      const from = (opts.page - 1) * opts.pageSize;
      const slice = sorted.slice(from, from + opts.pageSize);
      return {
        data: slice.map(toSummary),
        total: sorted.length,
        page: opts.page,
        page_size: opts.pageSize,
      };
    },
    async getProductById(id) {
      state.calls.push({ name: 'getProductById', args: [id] });
      const hit = state.products.find((p) => p.id === id);
      return hit ? { ...hit } : null;
    },
  };
}

export type FakeSearchState = {
  products: ProductDetail[];
  calls: { name: string; args: unknown[] }[];
};

export function createFakeSearch(state: FakeSearchState): SearchService {
  return {
    async searchProducts(opts: SearchOpts) {
      state.calls.push({ name: 'searchProducts', args: [opts] });
      let results = [...state.products];
      if (opts.category !== undefined && opts.category.trim().length > 0) {
        const lower = opts.category.trim().toLowerCase();
        results = results.filter((p) => p.category.toLowerCase() === lower);
      }
      // Simulate relevance: products whose title includes the query score
      // highest; stable scoring by id otherwise.
      const q = opts.query.toLowerCase();
      const scored = results.map((p, idx) => {
        const titleHit = p.title.toLowerCase().includes(q) ? 10 : 0;
        const brandHit = (p.brand ?? '').toLowerCase().includes(q) ? 5 : 0;
        return {
          product: p,
          score: titleHit + brandHit - idx * 0.01,
        };
      });
      scored.sort((a, b) => b.score - a.score);
      const ordered = scored.map((x) => x.product);
      const from = (opts.page - 1) * opts.pageSize;
      const slice = ordered.slice(from, from + opts.pageSize);
      return {
        data: slice.map(toSummary),
        total: ordered.length,
        page: opts.page,
        page_size: opts.pageSize,
      };
    },
  };
}
