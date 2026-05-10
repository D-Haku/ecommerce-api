// Feature: ecommerce-api, Property 10: Products routing for query and category combinations
// Validates: Requirements 8.1, 8.7, 9.1

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { routeProductsRequest } from '../../src/shared/routing.js';

// Generators that produce strings including whitespace-only and empty values.
const whitespaceOnly = fc
  .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 0, maxLength: 5 })
  .map((xs) => xs.join(''));

const nonEmptyAfterTrim = fc
  .string({ minLength: 1, maxLength: 16 })
  .filter((s) => s.trim().length > 0);

const stringLike = fc.oneof(
  whitespaceOnly,
  nonEmptyAfterTrim,
  fc.constant(''),
);

const optional = <T>(arb: fc.Arbitrary<T>): fc.Arbitrary<T | undefined> =>
  fc.oneof(arb, fc.constant(undefined));

describe('Property 10: routeProductsRequest decision rules', () => {
  it('returns search iff trimmed query is non-empty, else category iff trimmed category is non-empty, else list', () => {
    fc.assert(
      fc.property(optional(stringLike), optional(stringLike), (query, category) => {
        const result = routeProductsRequest({ query, category });
        const queryTrimmedNonEmpty =
          typeof query === 'string' && query.trim().length > 0;
        const categoryTrimmedNonEmpty =
          typeof category === 'string' && category.trim().length > 0;

        if (queryTrimmedNonEmpty) {
          expect(result.kind).toBe('search');
          if (result.kind === 'search') {
            expect(result.query).toBe((query as string).trim());
            if (categoryTrimmedNonEmpty) {
              expect(result.category).toBe((category as string).trim());
            } else {
              expect(result.category).toBeUndefined();
            }
          }
        } else if (categoryTrimmedNonEmpty) {
          expect(result.kind).toBe('category');
          if (result.kind === 'category') {
            expect(result.category).toBe((category as string).trim());
          }
        } else {
          expect(result.kind).toBe('list');
        }
      }),
      { numRuns: 200 },
    );
  });
});
