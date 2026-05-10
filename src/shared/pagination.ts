// Pagination normalization and validation.

import { ValidationError } from './errors.js';
import type { Pagination } from './types.js';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export const PAGE_SIZE_CAP = MAX_PAGE_SIZE;

export type PaginationQuery = {
  page?: unknown;
  page_size?: unknown;
};

function parsePositiveInteger(
  name: string,
  raw: unknown,
  defaultValue: number,
): number {
  if (raw === undefined || raw === null || raw === '') {
    return defaultValue;
  }
  // Accept number or numeric string; reject anything else.
  let value: number;
  if (typeof raw === 'number') {
    value = raw;
  } else if (typeof raw === 'string') {
    // Require an integer-only string (no decimals, no whitespace padding).
    if (!/^-?\d+$/.test(raw)) {
      throw new ValidationError(`invalid ${name}: must be a positive integer`);
    }
    value = Number(raw);
  } else {
    throw new ValidationError(`invalid ${name}: must be a positive integer`);
  }

  if (!Number.isInteger(value)) {
    throw new ValidationError(`invalid ${name}: must be a positive integer`);
  }
  if (value < 1) {
    throw new ValidationError(`invalid ${name}: must be a positive integer`);
  }
  return value;
}

export function normalizePagination(query: PaginationQuery): Pagination {
  const page = parsePositiveInteger('page', query.page, DEFAULT_PAGE);
  const pageSizeRaw = parsePositiveInteger(
    'page_size',
    query.page_size,
    DEFAULT_PAGE_SIZE,
  );
  const pageSize = Math.min(pageSizeRaw, MAX_PAGE_SIZE);
  return { page, pageSize };
}
