import fc from 'fast-check';
import type {
  Category,
  ProductDetail,
} from '../../../src/shared/types.js';

export const categorySlugArb = fc.constantFrom(
  'beauty',
  'fragrances',
  'furniture',
  'groceries',
  'home-decoration',
  'laptops',
  'smartphones',
  'sunglasses',
  'tablets',
  'tops',
);

export const categoryArb: fc.Arbitrary<Category> = fc.record({
  id: fc.integer({ min: 1, max: 100 }),
  name: fc.string({ minLength: 1, maxLength: 24 }),
  slug: fc.string({ minLength: 1, maxLength: 24 }),
});

export function productDetailArb(opts: {
  idMin?: number;
  idMax?: number;
  fixedCategory?: string;
} = {}): fc.Arbitrary<ProductDetail> {
  const category = opts.fixedCategory
    ? fc.constant(opts.fixedCategory)
    : categorySlugArb;
  return fc.record({
    id: fc.integer({ min: opts.idMin ?? 1, max: opts.idMax ?? 10_000 }),
    title: fc.string({ minLength: 1, maxLength: 32 }),
    description: fc.string({ maxLength: 32 }),
    price: fc
      .float({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true })
      .map((n) => Math.round(n * 100) / 100),
    category,
    brand: fc.option(fc.string({ minLength: 1, maxLength: 16 }), { nil: null }),
    stock: fc.integer({ min: 0, max: 1000 }),
    rating: fc
      .float({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true })
      .map((n) => Math.round(n * 100) / 100),
    thumbnail: fc.string({ maxLength: 64 }),
    discount_percentage: fc
      .float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })
      .map((n) => Math.round(n * 100) / 100),
    sku: fc.option(fc.string({ minLength: 1, maxLength: 16 }), { nil: null }),
    weight: fc.option(
      fc
        .float({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true })
        .map((n) => Math.round(n * 1000) / 1000),
      { nil: null },
    ),
    images: fc.array(fc.string({ minLength: 1, maxLength: 32 }), {
      maxLength: 3,
    }),
    tags: fc.array(fc.string({ minLength: 1, maxLength: 16 }), {
      maxLength: 3,
    }),
  });
}

export const uniqueProductsArb = (maxLen = 12) =>
  fc.array(productDetailArb(), { minLength: 0, maxLength: maxLen }).map(
    (arr) => {
      const seen = new Map<number, (typeof arr)[number]>();
      for (const p of arr) seen.set(p.id, p);
      return Array.from(seen.values());
    },
  );

export const uniqueCategoriesArb = (maxLen = 10) =>
  fc.array(categoryArb, { minLength: 1, maxLength: maxLen }).map((arr) => {
    const byName = new Map<string, Category>();
    const bySlug = new Map<string, Category>();
    const byId = new Map<number, Category>();
    let nextId = 1;
    for (const c of arr) {
      if (byName.has(c.name) || bySlug.has(c.slug)) continue;
      const id = byId.has(c.id) ? nextId++ : c.id;
      if (nextId <= c.id) nextId = c.id + 1;
      const normalized = { ...c, id };
      byName.set(c.name, normalized);
      bySlug.set(c.slug, normalized);
      byId.set(id, normalized);
    }
    return Array.from(byId.values());
  });
