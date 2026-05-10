// Domain model and source shape types.

export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type ProductSummary = {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  brand: string | null;
  stock: number;
  rating: number;
  thumbnail: string;
};

export type ProductDetail = ProductSummary & {
  discount_percentage: number;
  sku: string | null;
  weight: number | null;
  images: string[];
  tags: string[];
};

export type Pagination = {
  page: number;
  pageSize: number;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  page_size: number;
};

export type SourceProduct = {
  id: number;
  title: string;
  description: string;
  category: string;
  price: number;
  discountPercentage: number;
  rating: number;
  stock: number;
  tags: string[];
  brand?: string | null;
  sku?: string | null;
  weight?: number | null;
  thumbnail: string;
  images: string[];
};

export type SourcePage = {
  products: SourceProduct[];
  total: number;
  skip: number;
  limit: number;
};

export type DataSource =
  | { kind: 'search'; query: string; category?: string }
  | { kind: 'category'; category: string }
  | { kind: 'list' };

export type MappedProduct = {
  product: {
    id: number;
    title: string;
    description: string;
    price: number;
    discount_percentage: number;
    rating: number;
    stock: number;
    brand: string | null;
    sku: string | null;
    weight: number | null;
    thumbnail: string;
  };
  category: {
    slug: string;
    name: string;
  };
  images: string[];
  tags: string[];
};
