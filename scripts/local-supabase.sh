#!/usr/bin/env bash
# Real official Supabase services on a lightweight local PostgreSQL, for isolated tests.
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
log_file=/tmp/gianno-supabase-runtime.log
compose() { docker compose -f .local-supabase/compose.yml "$@"; }
case "${1:-start}" in
  install-cli) bash scripts/supabase-cli.sh install ;;
  start)
    node scripts/local-stack.mjs
    echo 'Starting real local Auth, PostgreSQL, REST and private Storage services.'
    compose up -d > "$log_file" 2>&1
    ready=false
    for attempt in {1..60}; do
      if compose exec -T db psql -U postgres -Atc "select to_regclass('auth.users') is not null and to_regclass('storage.objects') is not null" 2>> "$log_file" | tail -1 | rg -q '^t$'; then ready=true; break; fi
      sleep 1
    done
    if [ "$ready" != true ]; then echo "Real Auth/Storage schema initialization failed; inspect $log_file privately." >&2; exit 1; fi
    compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 <<'SQL' >> "$log_file" 2>&1
create or replace function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') $$;
SQL
    compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 <<'SQL' >> "$log_file" 2>&1
create schema if not exists gianno_local;
revoke all on schema gianno_local from public,anon,authenticated;
do $$ begin
 if to_regclass('public.gianno_local_migrations') is not null then
  alter table public.gianno_local_migrations set schema gianno_local;
  alter table gianno_local.gianno_local_migrations rename to migrations;
 end if;
end $$;
create table if not exists gianno_local.migrations(name text primary key);
revoke all on gianno_local.migrations from public,anon,authenticated;
SQL
    for migration in supabase/migrations/*.sql; do
      name="$(basename "$migration")"
      applied="$(compose exec -T db psql -U postgres -Atc "select count(*) from gianno_local.migrations where name='$name'" 2>> "$log_file")"
      if [ "$applied" = 0 ]; then
        { echo 'begin;'; cat "$migration"; echo "insert into gianno_local.migrations(name) values('$name'); commit;"; } | compose exec -T db psql -U postgres -v ON_ERROR_STOP=1 >> "$log_file" 2>&1
      fi
    done
    compose exec -T db psql -U postgres -c "NOTIFY pgrst, 'reload schema';" >> "$log_file" 2>&1
    node --input-type=module <<'JS'
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
const s=JSON.parse(readFileSync('.local-supabase/credentials.json','utf8'));
for(let i=0;i<30;i++){try{const r=await fetch(s.API_URL+'/auth/v1/health');if(r.ok)break;if(i===29)throw new Error('Local Auth is not healthy.');}catch(e){if(i===29)throw e;}await new Promise(r=>setTimeout(r,1000));}
for(const path of ['/auth/v1/health','/rest/v1/','/storage/v1/status']){let ready=false;for(let i=0;i<30;i++){try{const r=await fetch(s.API_URL+path,{headers:{apikey:s.ANON_KEY,Authorization:'Bearer '+s.ANON_KEY}});if(r.ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,1000));}if(!ready)throw new Error('Local service readiness failed: '+path);}
if(!existsSync('.env.local')){writeFileSync('.env.local',`# Local isolated development only\nNEXT_PUBLIC_SUPABASE_URL=${s.API_URL}\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${s.ANON_KEY}\nNEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000\n`,{flag:'wx',mode:0o600});console.log('Created ignored .env.local with public local connection only.');}else console.log('Existing .env.local preserved.');
console.log('Local Supabase Auth and application migrations ready.');
JS
    ;;
  status) compose ps --format '{{.Service}} {{.State}}' ;;
  stop) compose stop >> "$log_file" 2>&1; echo 'Local services stopped; persistent data retained.' ;;
  *) echo 'Usage: scripts/local-supabase.sh [start|status|stop|install-cli]' >&2; exit 2 ;;
esac
