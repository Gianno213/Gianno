#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
name="gianno-demo-setup-test-$$"
trap 'docker rm -f "$name" >/dev/null 2>&1 || true' EXIT
docker run --name "$name" -e POSTGRES_PASSWORD=local-test-only -p 127.0.0.1::5432 -d postgres:17-alpine >/dev/null
for attempt in {1..30}; do if docker exec "$name" pg_isready -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U postgres < supabase/tests/bootstrap.sql >/dev/null
docker exec "$name" psql -X -v ON_ERROR_STOP=1 -U postgres -c "insert into auth.users(id) values ('00000000-0000-4000-8000-000000000001');" >/dev/null
port="$(docker port "$name" 5432/tcp)"
GIANNO_DEMO_TEST_PORT="${port##*:}" node --input-type=module <<'JS'
import pg from 'pg';
import {prepareDemo} from './scripts/prepare-demo.mjs';
import assert from 'node:assert/strict';
const url=`postgres://postgres:local-test-only@127.0.0.1:${process.env.GIANNO_DEMO_TEST_PORT}/postgres`;
const env={GIANNO_LOCAL_DEMO_TEST:'1',GIANNO_DEMO_CONFIRM:'DEMO',DEMO_DATABASE_URL:url,DEMO_DIRECTION_ID:'00000000-0000-4000-8000-000000000001'};
await prepareDemo(env);
const client=new pg.Client({connectionString:url});await client.connect();
assert.equal((await client.query('select count(*)::int n from public.employees')).rows[0].n,3);
assert.equal((await client.query('select count(*)::int n from public.locations')).rows[0].n,2);
assert.equal((await client.query('select count(*)::int n from gianno_demo_setup.migrations')).rows[0].n,3);
assert.equal((await client.query('select count(*)::int n from public.evaluation_criteria')).rows[0].n,5);
await client.query("update public.employees set job_title='Prova conservata' where employee_code='DEMO-001'");
await prepareDemo(env);
assert.equal((await client.query('select count(*)::int n from public.employees')).rows[0].n,3);
assert.equal((await client.query("select job_title from public.employees where employee_code='DEMO-001'")).rows[0].job_title,'Prova conservata');
await client.query("update public.companies set name='Azienda reale da non toccare'");
await assert.rejects(()=>prepareDemo(env),/non dimostrativo/);
assert.equal((await client.query('select name from public.companies')).rows[0].name,'Azienda reale da non toccare');
await client.end();console.log('PASS: migrazioni reali, seed demo, idempotenza, conservazione prove e rifiuto database non demo.');
JS
