// JSON Schemas for the categories routes.

export const CategorySchema = {
  type: 'object',
  required: ['id', 'name', 'slug'],
  additionalProperties: false,
  properties: {
    id: { type: 'integer' },
    name: { type: 'string' },
    slug: { type: 'string' },
  },
} as const;

export const CategoriesListResponseSchema = {
  type: 'array',
  items: CategorySchema,
} as const;
