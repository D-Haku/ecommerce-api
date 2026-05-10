# ecommerce-api

A containerized REST API that ingests product catalog data from the public
DummyJSON products endpoint, persists it in MySQL as the authoritative store,
and indexes it into Elasticsearch as a derived full-text search index.

The entire stack runs with a single `docker compose up` command.

## Running locally with docker compose up

Prerequisites:

- Docker 24 or later with the Compose v2 plugin.
- Internet access at first startup so the ingest container can reach
  `https://dummyjson.com/products`.

From the repository root, run:

```
docker compose up
```

This command:

1. Pulls and starts the `mysql` and `elasticsearch` containers and waits for
   both to report healthy via their respective healthchecks.
2. Starts the `ingest` one-shot container which applies the SQL migrations,
   creates the `products` Elasticsearch index with an explicit mapping, fetches
   every product from DummyJSON (paginating 100 at a time), and upserts each
   record into MySQL and Elasticsearch keyed by the source product id.
3. Once `ingest` exits with code 0, Compose starts the `api` container which
   listens on host port 3000.

The API is then reachable at:

```
http://localhost:3000
```

Re-running `docker compose up` is safe: `ingest` upserts by source id and the
MySQL and Elasticsearch volumes persist data across runs.

To stop the stack and discard the data volumes:

```
docker compose down -v
```

## Running the tests

The test suite uses [vitest](https://vitest.dev/) with
[fast-check](https://fast-check.dev/) for property-based testing. Unit tests
cover pure functions and pure modules; property tests cover the 14
correctness properties derived from the requirements (routing decisions,
pagination envelope invariants, idempotent ingestion, retry bounds, error
envelope, README emoji-freeness, and more).

```
npm install
npm test -- --run
```

Expected: 18 test files, 41 tests passing.

To type-check without emitting JavaScript:

```
npm run typecheck
```

## Project structure

```
.
├── Dockerfile.api               API container (Node 20, Fastify server)
├── Dockerfile.ingest            One-shot ingest container
├── docker-compose.yml           mysql + elasticsearch + ingest + api
├── migrations/
│   └── 001_init.sql             DDL for categories, products,
│                                  product_images, product_tags
├── scripts/
│   └── e2e.sh                   Smoke test script
├── src/
│   ├── api/
│   │   ├── server.ts            Fastify bootstrap, plugin order
│   │   ├── plugins/             correlationId, errorHandler
│   │   ├── routes/              categories, products, health
│   │   ├── schemas/              JSON Schemas for requests and responses
│   │   └── services/             catalog (MySQL), search (Elasticsearch)
│   ├── ingest/
│   │   ├── index.ts             Orchestrator
│   │   ├── source.ts            DummyJSON fetch with retry
│   │   ├── migrations.ts        SQL migration runner
│   │   ├── mysql.ts             Transactional upsert
│   │   └── elasticsearch.ts     Index bootstrap + bulk upsert
│   └── shared/                  config, logger, pagination, routing,
│                                 mapping, types, errors
└── test/
    ├── unit/                     Pure-function unit tests
    └── property/                 fast-check property tests + in-memory fakes
```

## Design choices

### MySQL as the source of truth; Elasticsearch as a derived index

The catalog has two distinct workloads. Category listings and product detail
retrieval want normalized relational integrity: a product belongs to exactly
one category, tags and images are child rows, and the category list is a
simple ordered projection. Full-text search, on the other hand, wants
analyzed text fields, keyword filters, and relevance scoring. Treating MySQL
as authoritative and Elasticsearch as a derived index gives each workload the
engine that fits it while keeping a single, consistent write path through the
ingest job.

Consequences of this split:

- The ingest script writes to MySQL first and then bulk-indexes into
  Elasticsearch. If the Elasticsearch write fails, the MySQL state is still
  valid and a re-run of ingest recovers the index.
- Search requests never touch MySQL. Category filter and list requests never
  touch Elasticsearch. The API routing function in `src/shared/routing.ts`
  encodes exactly which data source each request hits.
- The document `_id` in Elasticsearch is set from the source product id,
  which makes bulk indexing naturally idempotent.

### Fastify with JSON Schema validation

Fastify applies request validation as JSON Schema before the handler runs,
which enforces the `page`, `page_size`, and `/products/:id` integer
constraints at the framework level. Our handlers then only see well-typed
parameters, and the error handler plugin translates validation failures into
the shared `{ message }` envelope with `application/json`.

### Strict index mapping

The Elasticsearch mapping uses `"dynamic": "strict"`. If the DummyJSON source
ever emits an unexpected field, ingest fails loudly instead of silently
growing the mapping. This keeps the index shape a deliberate decision rather
than an emergent one.

### Typed configuration with fail-fast parsing

`src/shared/config.ts` parses `process.env` through a zod schema. Missing or
invalid required variables (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME`, `ES_NODE`) cause a descriptive error at startup in both the ingest
and api containers, which surfaces in `docker compose up` logs.

### Correlation ids on every response

Every request gets a UUID as its correlation id, echoed back in
`X-Correlation-Id` and included in 500 error bodies. This makes it trivial to
tie a user-visible failure to its stack trace in the logs.

## Known limitations and trade-offs

- Ingest is a one-shot job run at container start. There is no near-real-time
  sync between MySQL and Elasticsearch after that. Re-running ingest is the
  supported way to refresh the index.
- Elasticsearch runs single-node with security disabled and a small heap. This
  is appropriate for a local evaluation environment and not a production
  configuration.
- The API is read-only. There are no create, update, or delete endpoints and
  no authentication layer.
- Category names are derived from the DummyJSON `category` string via a
  slug-to-title conversion. The display name may diverge from a curated
  editorial catalog.
- `products.sku` is a nullable unique key. MySQL treats multiple NULL values
  in a unique index as distinct, so products without a SKU do not collide.
  Products that share a non-null SKU would collide, which is the intended
  behavior but worth noting for anyone adapting this code to a different data
  source.
- The search endpoint paginates through the standard `from`/`size` DSL. Very
  deep pagination (for example `page=5000`) will hit Elasticsearch defaults;
  deep scrolling or `search_after` is out of scope.

## API endpoints

All responses are `application/json`. Error responses use the shape:

```json
{ "message": "string", "correlationId": "optional uuid on 500" }
```

### GET /health

Used by the Docker health probe.

Response:

```json
{ "status": "ok" }
```

### GET /categories

Returns all categories sorted by name ascending.

Response:

```json
[
  { "id": 1, "name": "Beauty", "slug": "beauty" },
  { "id": 2, "name": "Laptops", "slug": "laptops" },
  { "id": 3, "name": "Smartphones", "slug": "smartphones" }
]
```

### GET /products

Query parameters:

| Name         | Type    | Default | Notes                                           |
|--------------|---------|---------|-------------------------------------------------|
| `page`       | integer | 1       | Must be a positive integer.                     |
| `page_size`  | integer | 20      | Must be a positive integer; capped at 100.      |
| `query`      | string  | absent  | If non-empty after trim, serves via Elasticsearch. |
| `category`   | string  | absent  | If non-empty after trim, filters by category slug case-insensitively. |

Routing:

- `query` non-empty after trim: serves from Elasticsearch with relevance
  ordering on `title`, `brand`, `tags`, and `description`. If `category` is
  also supplied, results are filtered to that category.
- `query` absent or whitespace-only, `category` non-empty after trim: serves
  from MySQL filtered on `LOWER(categories.slug) = LOWER(?)`.
- Neither supplied: lists all products from MySQL ordered by id.

Example: `GET /products?page=1&page_size=2`

```json
{
  "data": [
    {
      "id": 1,
      "title": "Essence Mascara Lash Princess",
      "description": "The Essence Mascara Lash Princess is a popular mascara known for its volumizing and lengthening effects.",
      "price": 9.99,
      "category": "beauty",
      "brand": "Essence",
      "stock": 99,
      "rating": 2.56,
      "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp"
    },
    {
      "id": 2,
      "title": "Eyeshadow Palette with Mirror",
      "description": "The Eyeshadow Palette with Mirror offers a versatile range of eyeshadow shades.",
      "price": 19.99,
      "category": "beauty",
      "brand": "Glamour Beauty",
      "stock": 34,
      "rating": 2.86,
      "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/eyeshadow-palette-with-mirror/thumbnail.webp"
    }
  ],
  "total": 194,
  "page": 1,
  "page_size": 2
}
```

Example: `GET /products?query=iphone`

Same envelope; `data` is ordered by Elasticsearch relevance score descending.
Against the live dataset this returns 8 matches (iPhone 5s, iPhone 6,
iPhone X, and so on).

Example: `GET /products?category=smartphones`

Same envelope; `data` contains only products whose category slug is
`smartphones` (case-insensitive on input).

### GET /products/:id

Path parameter `id` must be a positive integer.

Example: `GET /products/1`

```json
{
  "id": 1,
  "title": "Essence Mascara Lash Princess",
  "description": "The Essence Mascara Lash Princess is a popular mascara known for its volumizing and lengthening effects.",
  "price": 9.99,
  "discount_percentage": 10.48,
  "rating": 2.56,
  "stock": 99,
  "brand": "Essence",
  "sku": "BEA-ESS-ESS-001",
  "weight": 4,
  "category": "beauty",
  "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
  "images": [
    "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp"
  ],
  "tags": ["beauty", "mascara"]
}
```

Error cases:

- `400` if `id` is not a positive integer.
- `404` if no product with that id exists.
- `503` if MySQL is unreachable.
- `500` with `correlationId` for unhandled exceptions.
