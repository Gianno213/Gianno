#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
name="gianno-policy-test-$$"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run --name "$name" -e POSTGRES_PASSWORD=local-test-only -e POSTGRES_DB=gianno_test -d postgres:17-alpine >/dev/null
for attempt in {1..30}; do
  if docker exec "$name" pg_isready -U postgres -d gianno_test >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d gianno_test < supabase/tests/bootstrap.sql
for migration in supabase/migrations/*.sql; do
  docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d gianno_test < "$migration"
done
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -d gianno_test < supabase/tests/policies.sql
