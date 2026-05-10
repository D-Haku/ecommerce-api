// DummyJSON source to domain model mapping helpers.

import type { MappedProduct, SourceProduct } from './types.js';

export function slugifyCategoryName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function titleizeSlug(slug: string): string {
  return slug
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function optionalString(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return value;
}

function optionalNumber(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }
  return value;
}

export function sourceToProduct(source: SourceProduct): MappedProduct {
  const slug = slugifyCategoryName(source.category);
  const name = titleizeSlug(slug);
  return {
    product: {
      id: source.id,
      title: source.title,
      description: source.description,
      price: source.price,
      discount_percentage: source.discountPercentage,
      rating: source.rating,
      stock: source.stock,
      brand: optionalString(source.brand),
      sku: optionalString(source.sku),
      weight: optionalNumber(source.weight),
      thumbnail: source.thumbnail,
    },
    category: { slug, name },
    images: [...source.images],
    tags: [...source.tags],
  };
}
