// Feature: ecommerce-api, Property 4: Dual-store ingestion idempotence
// Validates: Requirements 2.3, 2.4, 2.5, 2.6, 4.9

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { bulkIndexProducts } from '../../src/ingest/elasticsearch.js';
import { upsertAll } from '../../src/ingest/mysql.js';
import { sourceToProduct } from '../../src/shared/mapping.js';
import type { SourceProduct } from '../../src/shared/types.js';
import { FakeEsClient } from './_fakes/fake-elasticsearch.js';
import { FakePool } from './_fakes/fake-mysql.js';

const categorySlug = fc.constantFrom(
  'beauty',
  'fragrances',
  'furniture',
  'laptops',
  'smartphones',
);

const sourceProductArb: fc.Arbitrary<SourceProduct> = fc.record({
  id: fc.integer({ min: 1, max: 10_000 }),
  title: fc.string({ minLength: 1, maxLength: 32 }),
  description: fc.string({ maxLength: 64 }),
  category: categorySlug,
  price: fc.float({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
  discountPercentage: fc.float({
    min: 0,
    max: 100,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  rating: fc.float({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
  stock: fc.integer({ min: 0, max: 9_999 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 16 }), { maxLength: 5 }),
  brand: fc.option(fc.string({ minLength: 1, maxLength: 16 }), { nil: null }),
  sku: fc.option(fc.string({ minLength: 1, maxLength: 24 }), { nil: null }),
  weight: fc.option(
    fc.float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    { nil: null },
  ),
  thumbnail: fc.string({ maxLength: 64 }),
  images: fc.array(fc.string({ minLength: 1, maxLength: 64 }), { maxLength: 3 }),
});

const uniqueProductSet = fc
  .array(sourceProductArb, { minLength: 0, maxLength: 12 })
  .map((arr) => {
    const seen = new Map<number, SourceProduct>();
    for (const p of arr) {
      seen.set(p.id, p);
    }
    return Array.from(seen.values());
  });

describe('Property 4: dual-store ingestion idempotence', () => {
  it('running ingest twice yields the same final state as running it once', () => {
    fc.assert(
      fc.asyncProperty(uniqueProductSet, async (products) => {
        const mapped = products.map(sourceToProduct);

        // Run once
        const poolOnce = new FakePool();
        const esOnce = new FakeEsClient();
        esOnce.indexExists = true;
        await upsertAll(poolOnce as unknown as import('mysql2/promise').Pool, mapped);
        await bulkIndexProducts(
          esOnce as unknown as import('@elastic/elasticsearch').Client,
          mapped,
        );

        // Run twice
        const poolTwice = new FakePool();
        const esTwice = new FakeEsClient();
        esTwice.indexExists = true;
        await upsertAll(poolTwice as unknown as import('mysql2/promise').Pool, mapped);
        await bulkIndexProducts(
          esTwice as unknown as import('@elastic/elasticsearch').Client,
          mapped,
        );
        await upsertAll(poolTwice as unknown as import('mysql2/promise').Pool, mapped);
        await bulkIndexProducts(
          esTwice as unknown as import('@elastic/elasticsearch').Client,
          mapped,
        );

        expect(poolTwice.snapshotCanonical()).toEqual(
          poolOnce.snapshotCanonical(),
        );
        expect(esTwice.snapshotDocuments()).toEqual(esOnce.snapshotDocuments());
      }),
      { numRuns: 50 },
    );
  });
});
