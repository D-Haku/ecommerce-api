import { describe, expect, it } from 'vitest';
import { buildSearchBody } from '../../src/api/services/search.js';

describe('buildSearchBody', () => {
  it('builds a query-only body without a filter clause', () => {
    const body = buildSearchBody({
      query: 'phone',
      page: 1,
      pageSize: 20,
    });
    expect(body).toEqual({
      from: 0,
      size: 20,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: 'phone',
                fields: ['title^3', 'brand^2', 'tags^2', 'description'],
              },
            },
          ],
        },
      },
    });
    expect(body.query.bool.filter).toBeUndefined();
  });

  it('includes a lowercased category filter when category is supplied', () => {
    const body = buildSearchBody({
      query: 'laptop',
      category: 'Laptops',
      page: 1,
      pageSize: 20,
    });
    expect(body.query.bool.filter).toEqual([
      { term: { category: 'laptops' } },
    ]);
  });

  it('computes from as (page - 1) * pageSize', () => {
    expect(buildSearchBody({ query: 'x', page: 1, pageSize: 20 }).from).toBe(0);
    expect(buildSearchBody({ query: 'x', page: 2, pageSize: 20 }).from).toBe(20);
    expect(buildSearchBody({ query: 'x', page: 5, pageSize: 10 }).from).toBe(40);
  });

  it('omits filter when category is whitespace-only', () => {
    const body = buildSearchBody({
      query: 'q',
      category: '   ',
      page: 1,
      pageSize: 20,
    });
    expect(body.query.bool.filter).toBeUndefined();
  });
});
