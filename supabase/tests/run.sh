#!/usr/bin/env bash
# Local database tests: a throwaway supabase/postgres container, migrations,
# seed (twice, to prove it is re-runnable), then the RLS test file.
set -euo pipefail
cd "$(dirname "$0")/../.."
PORT=${DB_TEST_PORT:-54329}
IMAGE=${DB_TEST_IMAGE:-supabase/postgres:17.11.0.006}
NAME=rupshi-db-test
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "$PORT:5432" "$IMAGE" >/dev/null
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
export PGPASSWORD=postgres
for _ in $(seq 1 60); do
  psql -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -c 'select 1' >/dev/null 2>&1 && break
  sleep 2
done
sleep 3
ADMIN="psql -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p $PORT -U supabase_admin -d postgres"
$ADMIN -f supabase/tests/00_local_stubs.sql
for f in supabase/migrations/*.sql; do echo "migrate: $f"; $ADMIN -f "$f"; done
$ADMIN -f supabase/seed.sql
$ADMIN -f supabase/seed.sql
psql -v ON_ERROR_STOP=1 -q -h 127.0.0.1 -p "$PORT" -U postgres -d postgres -f supabase/tests/rls_test.sql 2>&1 \
  | grep -E 'NOTICE|ERROR|FAIL|PASSED' | sed -E 's/^psql:[^ ]+ //'
