import { randomBytes, createHmac } from "node:crypto";
import { mkdir, readFile, writeFile, stat, chmod } from "node:fs/promises";
import { existsSync } from "node:fs";
const dir = ".local-supabase";
await mkdir(dir, { recursive: true, mode: 0o700 });
let config;
if (existsSync(`${dir}/credentials.json`))
  config = JSON.parse(await readFile(`${dir}/credentials.json`, "utf8"));
else {
  const secret = randomBytes(48).toString("hex"),
    password = randomBytes(32).toString("hex");
  function jwt(role) {
    const enc = (x) => Buffer.from(JSON.stringify(x)).toString("base64url");
    const body =
      enc({ alg: "HS256", typ: "JWT" }) +
      "." +
      enc({
        role,
        iss: "supabase-local",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 315360000,
      });
    return (
      body + "." + createHmac("sha256", secret).update(body).digest("base64url")
    );
  }
  config = {
    API_URL: "http://127.0.0.1:54321",
    ANON_KEY: jwt("anon"),
    SERVICE_ROLE_KEY: jwt("service_role"),
    JWT_SECRET: secret,
    POSTGRES_PASSWORD: password,
  };
  await writeFile(`${dir}/credentials.json`, JSON.stringify(config), {
    mode: 0o600,
    flag: "wx",
  });
}
const p = config.POSTGRES_PASSWORD;
await writeFile(
  `${dir}/runtime.env`,
  Object.entries({
    ...config,
    GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${p}@db:5432/postgres`,
    PGRST_DB_URI: `postgres://authenticator:${p}@db:5432/postgres`,
    DATABASE_URL: `postgres://supabase_storage_admin:${p}@db:5432/postgres`,
    GOTRUE_JWT_SECRET: config.JWT_SECRET,
    PGRST_JWT_SECRET: config.JWT_SECRET,
    AUTH_JWT_SECRET: config.JWT_SECRET,
    SERVICE_KEY: config.SERVICE_ROLE_KEY,
  })
    .map(([k, v]) => `${k}=${v}`)
    .join("\n") + "\n",
  { mode: 0o600 },
);
await writeFile(
  `${dir}/bootstrap.sql`,
  String.raw`
create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password '${p}';
grant anon, authenticated, service_role to authenticator;
create role supabase_auth_admin login noinherit createrole password '${p}';
create role supabase_storage_admin login noinherit createrole password '${p}';
grant anon, authenticated, service_role to supabase_storage_admin;
create schema auth authorization supabase_auth_admin;
create schema storage authorization supabase_storage_admin;
grant usage on schema public,auth,storage to anon,authenticated,service_role;
grant all on schema public to supabase_storage_admin;
grant create on database postgres to supabase_auth_admin,supabase_storage_admin;
alter role supabase_auth_admin set search_path = auth,public;
alter role supabase_storage_admin set search_path = storage,public;
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role') $$;
alter function auth.uid() owner to supabase_auth_admin;
alter function auth.jwt() owner to supabase_auth_admin;
alter function auth.role() owner to supabase_auth_admin;
alter default privileges for role postgres in schema public grant all on tables to service_role;
alter default privileges for role postgres in schema public grant usage,select on sequences to service_role;
alter default privileges for role supabase_storage_admin in schema storage grant all on tables to authenticated,service_role;
alter default privileges for role supabase_storage_admin in schema storage grant usage,select on sequences to authenticated,service_role;
`,
  { mode: 0o600 },
);
await writeFile(
  `${dir}/kong.yml`,
  `_format_version: "2.1"
_transform: true
services:
  - name: auth
    url: http://auth:9999
    routes:
      - name: auth
        paths: ["/auth/v1/"]
        strip_path: true
    plugins:
      - name: cors
  - name: rest
    url: http://rest:3000
    routes:
      - name: rest
        paths: ["/rest/v1/"]
        strip_path: true
    plugins:
      - name: cors
  - name: storage
    url: http://storage:5000
    routes:
      - name: storage
        paths: ["/storage/v1/"]
        strip_path: true
    plugins:
      - name: cors
`,
  { mode: 0o600 },
);
await writeFile(
  `${dir}/compose.yml`,
  `name: gianno-local
services:
  db:
    image: postgres:17-alpine
    env_file: runtime.env
    ports: ["127.0.0.1:54322:5432"]
    volumes:
      - ./data/db:/var/lib/postgresql/data
      - ./bootstrap.sql:/docker-entrypoint-initdb.d/00-bootstrap.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 2s
      timeout: 3s
      retries: 30
  auth:
    image: supabase/gotrue:v2.186.0
    env_file: runtime.env
    depends_on:
      db: {condition: service_healthy}
    environment:
      GOTRUE_API_HOST: 0.0.0.0
      GOTRUE_API_PORT: 9999
      API_EXTERNAL_URL: http://127.0.0.1:54321/auth/v1
      GOTRUE_DB_DRIVER: postgres
      GOTRUE_SITE_URL: http://127.0.0.1:3000
      GOTRUE_URI_ALLOW_LIST: http://127.0.0.1:3000/auth/callback*,http://localhost:3000/auth/callback*
      GOTRUE_DISABLE_SIGNUP: "true"
      GOTRUE_JWT_ADMIN_ROLES: service_role
      GOTRUE_JWT_AUD: authenticated
      GOTRUE_JWT_DEFAULT_GROUP_NAME: authenticated
      GOTRUE_JWT_EXP: 3600
      GOTRUE_EXTERNAL_EMAIL_ENABLED: "true"
      GOTRUE_MAILER_AUTOCONFIRM: "true"
      GOTRUE_PASSWORD_MIN_LENGTH: 12
      GOTRUE_SECURITY_SECURE_PASSWORD_CHANGE_ENABLED: "true"
      GOTRUE_MFA_ENABLED: "true"
      GOTRUE_MFA_TOTP_ENROLL_ENABLED: "true"
      GOTRUE_MFA_TOTP_VERIFY_ENABLED: "true"
  rest:
    image: postgrest/postgrest:v14.3
    env_file: runtime.env
    depends_on:
      db: {condition: service_healthy}
    environment:
      PGRST_DB_SCHEMAS: public
      PGRST_DB_ANON_ROLE: anon
      PGRST_DB_EXTRA_SEARCH_PATH: public
      PGRST_DB_MAX_ROWS: 1000
  storage:
    image: supabase/storage-api:v1.35.3
    env_file: runtime.env
    depends_on:
      db: {condition: service_healthy}
    environment:
      POSTGREST_URL: http://rest:3000
      STORAGE_PUBLIC_URL: http://127.0.0.1:54321
      FILE_SIZE_LIMIT: 15728640
      STORAGE_BACKEND: file
      FILE_STORAGE_BACKEND_PATH: /var/lib/storage
      TENANT_ID: gianno-local
      REGION: local
      GLOBAL_S3_BUCKET: local
      ENABLE_IMAGE_TRANSFORMATION: "false"
    volumes:
      - ./data/storage:/var/lib/storage
  kong:
    image: kong:2.8.1
    depends_on: [auth,rest,storage]
    ports: ["127.0.0.1:54321:8000"]
    volumes:
      - ./kong.yml:/etc/kong/kong.yml:ro
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /etc/kong/kong.yml
      KONG_DNS_ORDER: LAST,A,CNAME
      KONG_PLUGINS: cors
      KONG_PROXY_ACCESS_LOG: /dev/null
      KONG_ADMIN_ACCESS_LOG: /dev/null
`,
  { mode: 0o600 },
);
await writeFile(
  process.env.GIANNO_LOCAL_STATUS || "/tmp/gianno-supabase-status.json",
  JSON.stringify(config),
  { mode: 0o600 },
);
console.log(
  "Private local Supabase configuration generated; no credential values displayed.",
);

// Container users need read access to these bind-mounted files; parent directory is 0700.
await chmod(`${dir}/bootstrap.sql`, 0o644);
await chmod(`${dir}/kong.yml`, 0o644);
