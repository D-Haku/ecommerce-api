// DummyJSON source fetcher with retry and pagination.

import { SourceFetchError } from '../shared/errors.js';
import type { SourcePage, SourceProduct } from '../shared/types.js';

export type Fetcher = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type Sleeper = (ms: number) => Promise<void>;

const defaultFetcher: Fetcher = async (url) => {
  const res = await fetch(url);
  return {
    ok: res.ok,
    status: res.status,
    json: () => res.json() as Promise<unknown>,
  };
};

const defaultSleeper: Sleeper = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

const MAX_ATTEMPTS = 3;

export function backoffMs(attempt: number): number {
  // attempt 1 -> 250ms, 2 -> 500ms, 3 -> 1000ms.
  if (attempt <= 1) return 250;
  if (attempt === 2) return 500;
  return 1000;
}

export type FetchPageDeps = {
  baseUrl: string;
  fetcher?: Fetcher;
  sleeper?: Sleeper;
};

export async function fetchPage(
  deps: FetchPageDeps,
  skip: number,
  limit: number,
  attempt = 1,
): Promise<SourcePage> {
  const fetcher = deps.fetcher ?? defaultFetcher;
  const sleeper = deps.sleeper ?? defaultSleeper;
  const url = `${deps.baseUrl}?limit=${limit}&skip=${skip}`;
  const res = await fetcher(url);
  if (!res.ok) {
    if (attempt >= MAX_ATTEMPTS) {
      throw new SourceFetchError(res.status, skip);
    }
    await sleeper(backoffMs(attempt));
    return fetchPage(deps, skip, limit, attempt + 1);
  }
  const body = (await res.json()) as SourcePage;
  return body;
}

export async function fetchAllProducts(
  deps: FetchPageDeps,
  pageSize = 100,
): Promise<SourceProduct[]> {
  const limit = Math.max(1, Math.min(100, pageSize));
  const out: SourceProduct[] = [];
  let skip = 0;
  // Loop until skip covers the reported total.
  // Termination guaranteed by monotone increase in skip or empty page.
  // Guard against degenerate servers that report total 0 but return data.
  // Cap iterations at a safe upper bound for defense in depth.
  const HARD_CAP = 10_000;
  for (let i = 0; i < HARD_CAP; i += 1) {
    const page = await fetchPage(deps, skip, limit);
    const products = Array.isArray(page.products) ? page.products : [];
    out.push(...products);
    const total = typeof page.total === 'number' ? page.total : out.length;
    skip += products.length;
    if (products.length === 0) {
      break;
    }
    if (skip >= total) {
      break;
    }
  }
  return out;
}
