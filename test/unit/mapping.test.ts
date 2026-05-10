import { describe, expect, it } from 'vitest';
import {
  slugifyCategoryName,
  sourceToProduct,
  titleizeSlug,
} from '../../src/shared/mapping.js';
import type { SourceProduct } from '../../src/shared/types.js';

function sample(overrides: Partial<SourceProduct> = {}): SourceProduct {
  return {
    id: 1,
    title: 'Test Product',
    description: 'desc',
    category: 'smartphones',
    price: 10,
    discountPercentage: 5,
    rating: 4.5,
    stock: 10,
    tags: ['t1', 't2'],
    brand: 'Brand',
    sku: 'SKU-1',
    weight: 1.5,
    thumbnail: 'https://example.com/t.png',
    images: ['https://example.com/1.png', 'https://example.com/2.png'],
    ...overrides,
  };
}

describe('slugifyCategoryName', () => {
  it('lowercases and replaces non alphanum runs with dashes', () => {
    expect(slugifyCategoryName('Home Decoration')).toBe('home-decoration');
    expect(slugifyCategoryName('Mens Watches')).toBe('mens-watches');
    expect(slugifyCategoryName('womens-jewellery')).toBe('womens-jewellery');
    expect(slugifyCategoryName('SKIN CARE!!!')).toBe('skin-care');
  });

  it('strips accents', () => {
    expect(slugifyCategoryName('Café')).toBe('cafe');
  });

  it('strips leading and trailing dashes', () => {
    expect(slugifyCategoryName('-foo-bar-')).toBe('foo-bar');
  });
});

describe('titleizeSlug', () => {
  it('converts dash-separated slugs to Title Case', () => {
    expect(titleizeSlug('home-decoration')).toBe('Home Decoration');
    expect(titleizeSlug('smartphones')).toBe('Smartphones');
    expect(titleizeSlug('mens-watches')).toBe('Mens Watches');
  });

  it('handles empty input', () => {
    expect(titleizeSlug('')).toBe('');
  });
});

describe('sourceToProduct', () => {
  it('maps required fields and preserves arrays', () => {
    const out = sourceToProduct(sample());
    expect(out.product.id).toBe(1);
    expect(out.category.slug).toBe('smartphones');
    expect(out.category.name).toBe('Smartphones');
    expect(out.tags).toEqual(['t1', 't2']);
    expect(out.images.length).toBe(2);
  });

  it('maps null/undefined optional fields to null', () => {
    const out = sourceToProduct(
      sample({ brand: undefined, sku: null, weight: undefined }),
    );
    expect(out.product.brand).toBeNull();
    expect(out.product.sku).toBeNull();
    expect(out.product.weight).toBeNull();
  });

  it('round-trips categories like home-decoration through slugify/titleize', () => {
    const categories = [
      'beauty',
      'fragrances',
      'furniture',
      'groceries',
      'home-decoration',
      'kitchen-accessories',
      'laptops',
      'mens-shirts',
      'mens-shoes',
      'mens-watches',
      'mobile-accessories',
      'motorcycle',
      'skin-care',
      'smartphones',
      'sports-accessories',
      'sunglasses',
      'tablets',
      'tops',
      'vehicle',
      'womens-bags',
      'womens-dresses',
      'womens-jewellery',
      'womens-shoes',
      'womens-watches',
    ];
    for (const cat of categories) {
      const slug = slugifyCategoryName(cat);
      expect(slug).toBe(cat);
      const name = titleizeSlug(slug);
      expect(slugifyCategoryName(name)).toBe(cat);
    }
  });
});
