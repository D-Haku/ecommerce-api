// Feature: ecommerce-api, Property 3: Source fetcher retry bound
// Validates: Requirements 2.2

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { SourceFetchError } from '../../src/shared/errors.js';
import { fetchPage, type Fetcher } from '../../src/ingest/source.js';

describe('Property 3: source fetcher retry bound', () => {
  it('makes exactly min(k, 3) attempts; resolves when k <= 3, throws otherwise', () => {
    // k: the attempt number at which the request would succeed. If k > 3, it
    // never succeeds within the allowed attempts.
    fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 8 }), async (k) => {
        let attempts = 0;
        const fetcher: Fetcher = async () => {
          attempts += 1;
          if (attempts >= k) {
            return {
              ok: true,
              status: 200,
              json: async () => ({
                products: [],
                total: 0,
                skip: 0,
                limit: 100,
              }),
            };
          }
          return {
            ok: false,
            status: 500,
            json: async () => ({}),
          };
        };

        const sleeper = async () => undefined;

        let thrown: unknown = null;
        try {
          await fetchPage(
            { baseUrl: 'http://fake', fetcher, sleeper },
            0,
            100,
          );
        } catch (err) {
          thrown = err;
        }

        const expectedAttempts = Math.min(k, 3);
        expect(attempts).toBe(expectedAttempts);
        if (k <= 3) {
          expect(thrown).toBeNull();
        } else {
          expect(thrown).toBeInstanceOf(SourceFetchError);
        }
      }),
      { numRuns: 100 },
    );
  });
});
