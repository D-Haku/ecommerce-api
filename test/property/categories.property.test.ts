// Feature: ecommerce-api, Property 5: Category listing shape and ascending order
// Validates: Requirements 5.2, 5.3, 5.4

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createFakeCatalog,
  createFakeSearch,
} from './_fakes/fake-services.js';
import { buildTestServer } from './_fakes/build-test-server.js';
import { uniqueCategoriesArb } from './_fakes/arbitraries.js';

describe('Property 5: /categories shape and ordering', () => {
  it('returns a sorted JSON array with exactly {id, name, slug} per element', () => {
    return fc.assert(
      fc.asyncProperty(uniqueCategoriesArb(), async (categories) => {
        const catalogState = {
          categories,
          products: [],
          calls: [] as { name: string; args: unknown[] }[],
        };
        const server = await buildTestServer({
          catalog: createFakeCatalog(catalogState),
          search: createFakeSearch({ products: [], calls: [] }),
        });
        try {
          const res = await server.inject({ method: 'GET', url: '/categories' });
          expect(res.statusCode).toBe(200);
          const body = res.json();
          expect(Array.isArray(body)).toBe(true);
          for (const element of body) {
            expect(Object.keys(element).sort()).toEqual(
              ['id', 'name', 'slug'].sort(),
            );
            expect(Number.isInteger(element.id)).toBe(true);
            expect(typeof element.name).toBe('string');
            expect(typeof element.slug).toBe('string');
          }
          const names = body.map((c: { name: string }) => c.name);
          const sortedNames = [...names].sort((a, b) => a.localeCompare(b));
          expect(names).toEqual(sortedNames);
        } finally {
          await server.close();
        }
      }),
      { numRuns: 40 },
    );
  });
});
