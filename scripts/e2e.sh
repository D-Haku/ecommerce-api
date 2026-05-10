#!/usr/bin/env bash
# End-to-end smoke test for the ecommerce-api stack.

set -euo pipefail

cleanup() {
  docker compose down -v >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose up -d --wait

curl -f http://localhost:3000/health
echo
curl -f http://localhost:3000/categories
echo
curl -f 'http://localhost:3000/products?page=1&page_size=3'
echo
curl -f 'http://localhost:3000/products?query=phone'
echo
curl -f 'http://localhost:3000/products?category=smartphones'
echo
curl -f http://localhost:3000/products/1
echo

echo "e2e smoke test complete"
