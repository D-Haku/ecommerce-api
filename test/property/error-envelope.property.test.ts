// Feature: ecommerce-api, Property 13: Error envelope on all 4xx and 5xx responses
// Validates: Requirements 10.1, 10.2

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createFakeCatalog,
  createFakeSearch,
} from './_fakes/fake-services.js';
import { buildTestServer } from './_fakes/build-test-server.js';
import type { CatalogService } from '../../src/api/services/catalog.js';

type Scenario = {
  name: string;
  url: string;
  catalog?: Partial<CatalogService>;
  expectRange: '4xx' | '5xx';
};

const scenarios: Scenario[] = [
  {
    name: 'invalid page param',
    url: '/products?page=-1',
    expectRange: '4xx',
  },
  {
    name: 'invalid id path',
    url: '/products/-5',
    expectRange: '4xx',
  },
  {
    name: 'missing product id',
    url: '/products/99999',
    expectRange: '4xx',
  },
  {
    name: 'catalog throws unhandled',
    url: '/categories',
    expectRange: '5xx',
    catalog: {
      async listCategories(): Promise<never> {
        throw new Error('boom');
      },
    },
  },
  {
    name: 'catalog reports connection refused',
    url: '/categories',
    expectRange: '5xx',
    catalog: {
      async listCategories(): Promise<never> {
        throw Object.assign(new Error('connect ECONNREFUSED'), {
          code: 'ECONNREFUSED',
        });
      },
    },
  },
];

describe('Property 13: uniform error envelope on 4xx/5xx', () => {
  it('every error path returns application/json with a string message', () => {
    return fc.assert(
      fc.asyncProperty(fc.constantFrom(...scenarios), async (scenario) => {
        const baseCatalog = createFakeCatalog({
          categories: [],
          products: [],
          calls: [],
        });
        const catalog: CatalogService = {
          ...baseCatalog,
          ...scenario.catalog,
        };
        const server = await buildTestServer({
          catalog,
          search: createFakeSearch({ products: [], calls: [] }),
        });
        try {
          const res = await server.inject({ method: 'GET', url: scenario.url });
          const status = res.statusCode;
          if (scenario.expectRange === '4xx') {
            expect(status).toBeGreaterThanOrEqual(400);
            expect(status).toBeLessThan(500);
          } else {
            expect(status).toBeGreaterThanOrEqual(500);
            expect(status).toBeLessThan(600);
          }
          expect(res.headers['content-type']).toMatch(/application\/json/);
          const body = res.json();
          expect(typeof body.message).toBe('string');
        } finally {
          await server.close();
        }
      }),
      { numRuns: scenarios.length * 4 },
    );
  });
});
