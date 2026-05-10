// Feature: ecommerce-api, Property 9: Product detail fields in /products/{id} response
// Validates: Requirements 7.3

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  createFakeCatalog,
  createFakeSearch,
} from './_fakes/fake-services.js';
import { buildTestServer } from './_fakes/build-test-server.js';
import { productDetailArb } from './_fakes/arbitraries.js';

const REQUIRED = [
  'id',
  'title',
  'description',
  'price',
  'discount_percentage',
  'rating',
  'stock',
  'brand',
  'sku',
  'weight',
  'category',
  'thumbnail',
  'images',
  'tags',
].sort();

describe('Property 9: product detail fields in /products/{id}', () => {
  it('returns exactly the required fields with the right types', () => {
    return fc.assert(
      fc.asyncProperty(productDetailArb(), async (product) => {
        const server = await buildTestServer({
          catalog: createFakeCatalog({
            categories: [],
            products: [product],
            calls: [],
          }),
          search: createFakeSearch({ products: [product], calls: [] }),
        });
        try {
          const res = await server.inject({
            method: 'GET',
            url: `/products/${product.id}`,
          });
          expect(res.statusCode).toBe(200);
          const body = res.json();
          expect(Object.keys(body).sort()).toEqual(REQUIRED);
          expect(Number.isInteger(body.id)).toBe(true);
          expect(typeof body.title).toBe('string');
          expect(typeof body.description).toBe('string');
          expect(typeof body.price).toBe('number');
          expect(typeof body.discount_percentage).toBe('number');
          expect(typeof body.rating).toBe('number');
          expect(Number.isInteger(body.stock)).toBe(true);
          expect(body.brand === null || typeof body.brand === 'string').toBe(
            true,
          );
          expect(body.sku === null || typeof body.sku === 'string').toBe(true);
          expect(
            body.weight === null || typeof body.weight === 'number',
          ).toBe(true);
          expect(typeof body.category).toBe('string');
          expect(typeof body.thumbnail).toBe('string');
          expect(Array.isArray(body.images)).toBe(true);
          for (const img of body.images) expect(typeof img).toBe('string');
          expect(Array.isArray(body.tags)).toBe(true);
          for (const tag of body.tags) expect(typeof tag).toBe('string');
        } finally {
          await server.close();
        }
      }),
      { numRuns: 40 },
    );
  });
});
