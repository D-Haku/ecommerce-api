// JSON Schemas for the /products routes.
//
// Query and path parameters arrive as strings, so we validate them with a
// strict decimal-only regex to avoid AJV's permissive type coercion (which
// accepts hex literals like "0x10" and scientific notation like "1e2" when
// the schema type is `integer`). The handlers parse the matched string via
// the shared pagination helper.

export const ProductsListQuerySchema = {
  type: 'object',
  additionalProperties: true,
  properties: {
    page: { type: 'string', pattern: '^[1-9][0-9]*$' },
    page_size: { type: 'string', pattern: '^[1-9][0-9]*$' },
    query: { type: 'string' },
    category: { type: 'string' },
  },
} as const;

export const ProductIdParamSchema = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', pattern: '^[1-9][0-9]*$' },
  },
} as const;

export const ProductSummarySchema = {
  type: 'object',
  required: [
    'id',
    'title',
    'description',
    'price',
    'category',
    'brand',
    'stock',
    'rating',
    'thumbnail',
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    description: { type: 'string' },
    price: { type: 'number' },
    category: { type: 'string' },
    brand: { type: ['string', 'null'] },
    stock: { type: 'integer' },
    rating: { type: 'number' },
    thumbnail: { type: 'string' },
  },
} as const;

export const ProductDetailSchema = {
  type: 'object',
  required: [
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
  ],
  additionalProperties: false,
  properties: {
    id: { type: 'integer' },
    title: { type: 'string' },
    description: { type: 'string' },
    price: { type: 'number' },
    discount_percentage: { type: 'number' },
    rating: { type: 'number' },
    stock: { type: 'integer' },
    brand: { type: ['string', 'null'] },
    sku: { type: ['string', 'null'] },
    weight: { type: ['number', 'null'] },
    category: { type: 'string' },
    thumbnail: { type: 'string' },
    images: { type: 'array', items: { type: 'string' } },
    tags: { type: 'array', items: { type: 'string' } },
  },
} as const;

export const PaginatedProductsSchema = {
  type: 'object',
  required: ['data', 'total', 'page', 'page_size'],
  additionalProperties: false,
  properties: {
    data: { type: 'array', items: ProductSummarySchema },
    total: { type: 'integer', minimum: 0 },
    page: { type: 'integer', minimum: 1 },
    page_size: { type: 'integer', minimum: 1 },
  },
} as const;
