// Routing decision for GET /products. Isolated so it can be unit/property tested.

import type { DataSource } from './types.js';

export type RoutingInput = {
  query?: unknown;
  category?: unknown;
};

function trimmedNonEmpty(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function routeProductsRequest(input: RoutingInput): DataSource {
  const query = trimmedNonEmpty(input.query);
  const category = trimmedNonEmpty(input.category);

  if (query !== null) {
    if (category !== null) {
      return { kind: 'search', query, category };
    }
    return { kind: 'search', query };
  }
  if (category !== null) {
    return { kind: 'category', category };
  }
  return { kind: 'list' };
}
