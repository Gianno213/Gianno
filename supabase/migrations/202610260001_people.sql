-- GIANNO PEOPLE. Apply through Supabase migrations, never from a browser session.
create extension if not exists pgcrypto;
create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to authenticated;

create table public.companies (id uuid primary key default gen_random_uuid(), name text not null, retention_months integer not null default 60 check(retention_months between 12 and 120), created_at timestamptz not null default now());
create table public.profiles (id uuid primary key references auth.users(id), company_id uuid not null references companies(id), full_name text not null, role text not null check(role in ('direzione','hr','responsabile')), evaluations_access boolean not null default false, active boolean not null default true, created_at timestamptz not null default now());
create table public.locations (id uuid primary key default gen_random_uuid(), company_id uuid not null references companies(id), name text not null, address text not null default '', active boolean not null default true, unique(company_id,name));
create table public.user_locations (user_id uuid not null references profiles(id), location_id uuid not null references locations(id), primary key(user_id,location_id));
create table public.employees (id uuid primary key default gen_random_uuid(), company_id uuid not null references companies(id), location_id uuid not null references locations(id), employee_code text not null, first_name text not null, last_name text not null, job_title text not null, status text not null default 'attivo' check(status in ('attivo','cessato','sospeso')), hired_on date not null, photo_path text, created_at timestamptz not null default now(), unique(company_id,employee_code));
create table public.employee_private (employee_id uuid primary key references employees(id), birth_date date, email text, phone text, updated_at timestamptz not null default now());
create table public.contracts (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), contract_type text not null, ccnl_level text, weekly_hours numeric(5,2) not null check(weekly_hours between 0 and 60), starts_on date not null, ends_on date, notes text, created_at timestamptz not null default now(), check(ends_on is null or ends_on>=starts_on));
create table public.employment_history (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), location_id uuid not null references locations(id), job_title text not null, starts_on date not null, ends_on date, check(ends_on is null or ends_on>=starts_on));
create table public.evaluation_templates (id uuid primary key default gen_random_uuid(), company_id uuid not null references companies(id), name text not null, job_title text, version integer not null default 1 check(version>0), criteria jsonb not null, active boolean not null default true, created_at timestamptz not null default now(), unique(company_id,name,version));
create table public.evaluations (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), reviewer_id uuid not null default auth.uid() references profiles(id), period date not null check(extract(day from period)=1), template_id uuid not null references evaluation_templates(id), scores jsonb not null default '{}', comment text not null default '', status text not null default 'bozza' check(status in ('bozza','inviata','da_verificare','convalidata')), not_evaluable boolean not null default false, reason text, weighted_score numeric(4,2), revision integer not null default 1 check(revision>0), supersedes_id uuid unique references evaluations(id), rectification_reason text, validated_by uuid references profiles(id), validated_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(employee_id,period,revision));
create table public.diary_entries (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), location_id uuid not null references locations(id), author_id uuid not null default auth.uid() references profiles(id), event_on date not null default current_date, category text not null check(category in ('positivo','criticita','osservazione','miglioramento','formazione')), description text not null check(length(description) between 5 and 6000), action_taken text, verification_status text not null default 'da_verificare' check(verification_status in ('da_verificare','verificata','chiarimento_richiesto')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.diary_comments (id uuid primary key default gen_random_uuid(), entry_id uuid not null references diary_entries(id), author_id uuid not null default auth.uid() references profiles(id), body text not null check(length(body) between 1 and 6000), kind text not null default 'commento' check(kind in ('commento','rettifica','osservazione_dipendente')), created_at timestamptz not null default now());
create table public.goals (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), owner_id uuid not null default auth.uid() references profiles(id), description text not null, assigned_on date not null default current_date, due_on date, status text not null default 'da_iniziare' check(status in ('da_iniziare','in_corso','completato','da_rivedere')), comments text, outcome text, evaluation_id uuid references evaluations(id), created_at timestamptz not null default now());
create table public.training_records (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), title text not null, completed_on date, hours numeric(6,2) check(hours>=0), notes text, created_at timestamptz not null default now());
create table public.documents (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), kind text not null check(kind in ('contratto','busta_paga','altro')), filename text not null, storage_path text not null unique, sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'), uploaded_by uuid not null default auth.uid() references profiles(id), created_at timestamptz not null default now(), unique(employee_id,sha256));
create table public.payroll (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), document_id uuid not null unique references documents(id), year integer check(year between 2000 and 2200), month integer check(month between 1 and 12), kind text not null default 'ordinaria' check(kind in ('ordinaria','tredicesima','quattordicesima')), net_amount numeric(12,2) check(net_amount>=0), extraordinary_amount numeric(12,2) check(extraordinary_amount>=0), ordinary_confirmed boolean not null default false, status text not null default 'bozza' check(status in ('bozza','verificata')), extraction jsonb not null default '{}', verified_by uuid references profiles(id), verified_at timestamptz, correction_reason text, created_at timestamptz not null default now(), check(extraordinary_amount is null or extraordinary_amount<=net_amount), check(status<>'verificata' or (year is not null and month is not null and net_amount is not null and verified_by is not null and verified_at is not null)));
create unique index payroll_verified_period_unique on public.payroll(employee_id,year,month,kind) where status='verificata';
create table public.absences (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), kind text not null check(kind in ('ferie','permesso','malattia','assenza_tutelata','da_verificare','ritardo','altro')), starts_on date not null, ends_on date not null, hours numeric(8,2) not null check(hours>=0), notes text, created_at timestamptz not null default now(), check(ends_on>=starts_on));
create table public.attendance_records (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), work_date date not null, hours numeric(5,2) not null check(hours between 0 and 24), source text not null default 'manuale', created_at timestamptz not null default now(), unique(employee_id,work_date,source));
create table public.annual_plans (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), year integer not null check(year between 2000 and 2200), observations text not null, author_id uuid not null default auth.uid() references profiles(id), updated_at timestamptz not null default now(), unique(employee_id,year));
create table public.data_requests (id uuid primary key default gen_random_uuid(), employee_id uuid not null references employees(id), kind text not null check(kind in ('accesso','rettifica','cancellazione')), description text not null, status text not null default 'aperta' check(status in ('aperta','in_corso','chiusa')), received_on date not null default current_date, resolved_on date, created_at timestamptz not null default now());
create table public.audit_log (id bigint generated always as identity primary key, company_id uuid not null references companies(id), actor_id uuid references auth.users(id), table_name text not null, record_id text not null, action text not null, occurred_at timestamptz not null default now());
create table public.revision_history (id bigint generated always as identity primary key, company_id uuid not null references companies(id), table_name text not null, record_id text not null, actor_id uuid references auth.users(id), previous_data jsonb not null, changed_at timestamptz not null default now());

create or replace function app_private.company() returns uuid language sql stable security definer set search_path='' as $$ select company_id from public.profiles where id=auth.uid() and active $$;
create or replace function app_private.role() returns text language sql stable security definer set search_path='' as $$ select role from public.profiles where id=auth.uid() and active $$;
create or replace function app_private.aal2() returns boolean language sql stable set search_path='' as $$ select coalesce(auth.jwt()->>'aal','')='aal2' $$;
create or replace function app_private.admin() returns boolean language sql stable security definer set search_path='' as $$ select app_private.role() in ('direzione','hr') and app_private.aal2() $$;
create or replace function app_private.direction() returns boolean language sql stable security definer set search_path='' as $$ select app_private.role()='direzione' and app_private.aal2() $$;
create or replace function app_private.location_access(loc uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.locations l where l.id=loc and l.company_id=app_private.company() and (app_private.admin() or (app_private.role()='responsabile' and exists(select 1 from public.user_locations ul where ul.user_id=auth.uid() and ul.location_id=l.id)))) $$;
create or replace function app_private.employee_access(emp uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.employees e where e.id=emp and e.company_id=app_private.company() and app_private.location_access(e.location_id)) $$;
create or replace function app_private.sensitive(emp uuid) returns boolean language sql stable security definer set search_path='' as $$ select app_private.admin() and app_private.employee_access(emp) $$;
create or replace function app_private.evaluation_access(emp uuid, reviewer uuid) returns boolean language sql stable security definer set search_path='' as $$ select app_private.employee_access(emp) and (app_private.role()='direzione' or (app_private.role()='responsabile' and reviewer=auth.uid()) or (app_private.role()='hr' and exists(select 1 from public.profiles where id=auth.uid() and evaluations_access))) $$;

-- Validate company/resource boundaries regardless of RLS bypass by trusted provisioning.
create or replace function app_private.check_boundaries() returns trigger language plpgsql security definer set search_path='' as $$
declare c uuid; l uuid;
begin
 if TG_TABLE_NAME='employees' then
  select company_id into c from public.locations where id=new.location_id;
  if c is distinct from new.company_id then raise exception 'Sede e azienda non corrispondono'; end if;
 elsif TG_TABLE_NAME='user_locations' then
  if (select company_id from public.profiles where id=new.user_id) is distinct from (select company_id from public.locations where id=new.location_id) then raise exception 'Autorizzazione tra aziende non consentita'; end if;
 elsif TG_TABLE_NAME in ('diary_entries','employment_history') then
  select company_id into c from public.employees where id=new.employee_id;
  if c is distinct from (select company_id from public.locations where id=new.location_id) then raise exception 'Sede e dipendente non corrispondono'; end if;
  if TG_TABLE_NAME='diary_entries' and new.location_id is distinct from (select location_id from public.employees where id=new.employee_id) then raise exception 'La sede deve essere quella del dipendente'; end if;
 elsif TG_TABLE_NAME='payroll' then
  if new.employee_id is distinct from (select employee_id from public.documents where id=new.document_id and kind='busta_paga') then raise exception 'Documento busta paga non valido'; end if;
 end if;
 return new;
end $$;
create trigger employee_boundary before insert or update on employees for each row execute function app_private.check_boundaries();
create trigger assignment_boundary before insert or update on user_locations for each row execute function app_private.check_boundaries();
create trigger diary_boundary before insert or update on diary_entries for each row execute function app_private.check_boundaries();
create trigger history_boundary before insert or update on employment_history for each row execute function app_private.check_boundaries();
create trigger payroll_boundary before insert or update on payroll for each row execute function app_private.check_boundaries();

create or replace function app_private.validate_template() returns trigger language plpgsql set search_path='' as $$
declare item jsonb; total numeric:=0; keys text[]:='{}';
begin
 if TG_OP='UPDATE' and (new.criteria is distinct from old.criteria or new.version is distinct from old.version or new.company_id is distinct from old.company_id or new.job_title is distinct from old.job_title) then raise exception 'Creare una nuova versione del modello'; end if;
 if jsonb_typeof(new.criteria)<>'array' or jsonb_array_length(new.criteria)=0 then raise exception 'Criteri mancanti'; end if;
 for item in select value from jsonb_array_elements(new.criteria) loop
  if coalesce(item->>'key','')='' or coalesce(item->>'label','')='' or item->>'key'=any(keys) or jsonb_typeof(item->'weight') is distinct from 'number' or (item->>'weight')::numeric<=0 then raise exception 'Criterio non valido'; end if;
  total:=total+(item->>'weight')::numeric; keys:=array_append(keys,item->>'key');
 end loop;
 if total<>100 then raise exception 'I pesi devono totalizzare 100'; end if;
 return new;
end $$;
create trigger template_validation before insert or update on evaluation_templates for each row execute function app_private.validate_template();

create or replace function app_private.validate_evaluation() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.evaluation_templates; item jsonb; score numeric; total numeric:=0; predecessor public.evaluations; emp_company uuid;
begin
 select * into t from public.evaluation_templates where id=new.template_id;
 select company_id into emp_company from public.employees where id=new.employee_id;
 if t.company_id is distinct from emp_company or (select company_id from public.profiles where id=new.reviewer_id) is distinct from emp_company then raise exception 'Modello o responsabile non autorizzato'; end if;
 if TG_OP='UPDATE' then
  if old.status='convalidata' then raise exception 'Valutazione convalidata: creare rettifica tracciata'; end if;
  if (new.employee_id,new.period,new.template_id,new.reviewer_id,new.revision,new.supersedes_id) is distinct from (old.employee_id,old.period,old.template_id,old.reviewer_id,old.revision,old.supersedes_id) then raise exception 'Identità valutazione immutabile'; end if;
  if old.status<>'bozza' and not app_private.direction() then raise exception 'Solo la Direzione può riaprire una valutazione inviata'; end if;
 elsif new.supersedes_id is not null then
  select * into predecessor from public.evaluations where id=new.supersedes_id for update;
  if not app_private.direction() or predecessor.status<>'convalidata' or predecessor.employee_id<>new.employee_id or predecessor.period<>new.period or new.revision<>predecessor.revision+1 or length(trim(coalesce(new.rectification_reason,'')))<5 then raise exception 'Rettifica non valida o non autorizzata'; end if;
 elsif new.revision<>1 then raise exception 'Prima revisione deve essere 1';
 end if;
 if new.status in ('da_verificare','convalidata') and not app_private.direction() then raise exception 'Solo la Direzione può verificare o convalidare'; end if;
 if new.not_evaluable then
  if length(trim(coalesce(new.reason,'')))<5 then raise exception 'Motivazione non valutabilità obbligatoria'; end if;
  new.weighted_score:=null; new.scores:='{}';
 else
  if jsonb_typeof(new.scores)<>'object' then raise exception 'Punteggi non validi'; end if;
  if new.status<>'bozza' and (select count(*) from jsonb_object_keys(new.scores))<>jsonb_array_length(t.criteria) then raise exception 'Compilare tutti i criteri'; end if;
  for item in select value from jsonb_array_elements(t.criteria) loop
   score:=(new.scores->> (item->>'key'))::numeric;
   if score is not null and (score<1 or score>5 or score<>trunc(score)) then raise exception 'Punteggi interi da 1 a 5'; end if;
   if new.status<>'bozza' and score is null then raise exception 'Criterio mancante'; end if;
   if score<=2 and new.status<>'bozza' and length(trim(new.comment))<15 then raise exception 'Motivare le criticità con osservazioni professionali'; end if;
   total:=total+coalesce(score,0)*(item->>'weight')::numeric/100;
  end loop;
  if exists(select 1 from jsonb_object_keys(new.scores) k where not exists(select 1 from jsonb_array_elements(t.criteria) c where c->>'key'=k)) then raise exception 'Criterio sconosciuto'; end if;
  new.weighted_score:=round(total,2);
  if new.status<>'bozza' and length(trim(new.comment))<5 then raise exception 'Commento conclusivo obbligatorio'; end if;
 end if;
 if new.status='convalidata' then new.validated_by:=auth.uid(); new.validated_at:=now(); else new.validated_by:=null; new.validated_at:=null; end if;
 new.updated_at:=now(); return new;
end $$;
create trigger evaluation_validation before insert or update on evaluations for each row execute function app_private.validate_evaluation();

create or replace function app_private.guard_records() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='diary_entries' then
  if TG_OP='UPDATE' then
   if (new.employee_id,new.location_id,new.author_id,new.created_at) is distinct from (old.employee_id,old.location_id,old.author_id,old.created_at) then raise exception 'Identità nota immutabile'; end if;
   if new.verification_status is distinct from old.verification_status and not app_private.direction() then raise exception 'Verifica riservata alla Direzione'; end if;
   new.updated_at:=now();
  elsif new.verification_status<>'da_verificare' and not app_private.direction() then raise exception 'Verifica riservata alla Direzione'; end if;
 elsif TG_TABLE_NAME='payroll' then
  if TG_OP='UPDATE' and (new.employee_id,new.document_id,new.created_at) is distinct from (old.employee_id,old.document_id,old.created_at) then raise exception 'Identità busta paga immutabile'; end if;
  if TG_OP='UPDATE' and old.status='verificata' and length(trim(coalesce(new.correction_reason,'')))<5 then raise exception 'Motivazione rettifica obbligatoria'; end if;
  if new.status='verificata' then new.verified_by:=auth.uid();new.verified_at:=now(); else new.verified_by:=null;new.verified_at:=null; end if;
 elsif TG_TABLE_NAME='documents' then
  if new.storage_path <> new.employee_id::text || '/' || new.id::text || '.pdf' then raise exception 'Percorso documento non valido'; end if;
 end if;
 return new;
end $$;
create trigger diary_guard before insert or update on diary_entries for each row execute function app_private.guard_records();
create trigger payroll_guard before insert or update on payroll for each row execute function app_private.guard_records();
create trigger document_guard before insert or update on documents for each row execute function app_private.guard_records();

-- Audit contains identifiers, not confidential payloads. Previous values are in a separate restricted table.
create or replace function app_private.audit_change() returns trigger language plpgsql security definer set search_path='' as $$
declare payload jsonb; comp uuid; rid text;
begin
 payload:=case when TG_OP='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 rid:=coalesce(payload->>'id',payload->>'employee_id',payload->>'user_id');
 if payload ? 'company_id' then comp:=(payload->>'company_id')::uuid;
 elsif payload ? 'employee_id' then select company_id into comp from public.employees where id=(payload->>'employee_id')::uuid;
 elsif TG_TABLE_NAME='user_locations' then select company_id into comp from public.profiles where id=(payload->>'user_id')::uuid;
 elsif TG_TABLE_NAME='diary_comments' then select e.company_id into comp from public.diary_entries d join public.employees e on e.id=d.employee_id where d.id=(payload->>'entry_id')::uuid;
 else comp:=app_private.company(); end if;
 if comp is not null then
 insert into public.audit_log(company_id,actor_id,table_name,record_id,action) values(comp,auth.uid(),TG_TABLE_NAME,rid,TG_OP);
 if TG_OP='UPDATE' then insert into public.revision_history(company_id,table_name,record_id,actor_id,previous_data) values(comp,TG_TABLE_NAME,rid,auth.uid(),to_jsonb(old)); end if;
 end if;
 return null;
end $$;
do $$ declare t text; begin foreach t in array array['profiles','locations','user_locations','employees','employee_private','contracts','employment_history','evaluation_templates','evaluations','diary_entries','diary_comments','goals','training_records','documents','payroll','absences','attendance_records','annual_plans','data_requests'] loop execute format('create trigger audit_change after insert or update or delete on public.%I for each row execute function app_private.audit_change()',t);end loop;end $$;

-- Default deny: every table has RLS and only explicit policies below permit access.
do $$ declare t text; begin foreach t in array array['companies','profiles','locations','user_locations','employees','employee_private','contracts','employment_history','evaluation_templates','evaluations','diary_entries','diary_comments','goals','training_records','documents','payroll','absences','attendance_records','annual_plans','data_requests','audit_log','revision_history'] loop execute format('alter table public.%I enable row level security',t);end loop;end $$;
create policy company_read on companies for select to authenticated using(id=app_private.company());
create policy company_update on companies for update to authenticated using(id=app_private.company() and app_private.direction()) with check(id=app_private.company() and app_private.direction());
create policy profile_read on profiles for select to authenticated using(id=auth.uid() or (company_id=app_private.company() and app_private.direction()));
create policy profile_manage on profiles for all to authenticated using(company_id=app_private.company() and app_private.direction()) with check(company_id=app_private.company() and app_private.direction());
create policy location_read on locations for select to authenticated using(app_private.location_access(id));
create policy location_manage on locations for all to authenticated using(company_id=app_private.company() and app_private.direction()) with check(company_id=app_private.company() and app_private.direction());
create policy assignment_read on user_locations for select to authenticated using(user_id=auth.uid() or (app_private.direction() and exists(select 1 from profiles p where p.id=user_id and p.company_id=app_private.company())));
create policy assignment_manage on user_locations for all to authenticated using(app_private.direction() and exists(select 1 from profiles p where p.id=user_id and p.company_id=app_private.company())) with check(app_private.direction() and exists(select 1 from profiles p where p.id=user_id and p.company_id=app_private.company()) and exists(select 1 from locations l where l.id=location_id and l.company_id=app_private.company()));
create policy employee_read on employees for select to authenticated using(company_id=app_private.company() and app_private.location_access(location_id));
create policy employee_insert on employees for insert to authenticated with check(company_id=app_private.company() and app_private.admin() and app_private.location_access(location_id));
create policy employee_update on employees for update to authenticated using(company_id=app_private.company() and app_private.admin()) with check(company_id=app_private.company() and app_private.admin() and app_private.location_access(location_id));
do $$ declare t text; begin foreach t in array array['employee_private','contracts','documents','payroll','absences','attendance_records','data_requests'] loop
 execute format('create policy sensitive_read on public.%I for select to authenticated using(app_private.sensitive(employee_id))',t);
 execute format('create policy sensitive_insert on public.%I for insert to authenticated with check(app_private.sensitive(employee_id))',t);
 execute format('create policy sensitive_update on public.%I for update to authenticated using(app_private.sensitive(employee_id)) with check(app_private.sensitive(employee_id))',t);
end loop;end $$;
create policy history_read on employment_history for select to authenticated using(app_private.employee_access(employee_id));
create policy history_manage on employment_history for all to authenticated using(app_private.sensitive(employee_id)) with check(app_private.sensitive(employee_id));
create policy template_read on evaluation_templates for select to authenticated using(company_id=app_private.company());
create policy template_manage on evaluation_templates for all to authenticated using(company_id=app_private.company() and app_private.direction()) with check(company_id=app_private.company() and app_private.direction());
create policy evaluation_read on evaluations for select to authenticated using(app_private.evaluation_access(employee_id,reviewer_id));
create policy evaluation_insert on evaluations for insert to authenticated with check(app_private.employee_access(employee_id) and reviewer_id=auth.uid() and app_private.role() in ('direzione','responsabile'));
create policy evaluation_update on evaluations for update to authenticated using(app_private.evaluation_access(employee_id,reviewer_id) and (app_private.direction() or (reviewer_id=auth.uid() and status='bozza' and app_private.role()='responsabile'))) with check(app_private.employee_access(employee_id) and (app_private.direction() or (reviewer_id=auth.uid() and status in ('bozza','inviata') and app_private.role()='responsabile')));
create policy diary_read on diary_entries for select to authenticated using(app_private.employee_access(employee_id));
create policy diary_insert on diary_entries for insert to authenticated with check(app_private.employee_access(employee_id) and app_private.location_access(location_id) and author_id=auth.uid() and app_private.role() in ('direzione','responsabile'));
create policy diary_update on diary_entries for update to authenticated using(app_private.employee_access(employee_id) and (app_private.direction() or author_id=auth.uid())) with check(app_private.employee_access(employee_id) and (app_private.direction() or author_id=auth.uid()));
create policy comment_read on diary_comments for select to authenticated using(exists(select 1 from diary_entries d where d.id=entry_id and app_private.employee_access(d.employee_id)));
create policy comment_insert on diary_comments for insert to authenticated with check(author_id=auth.uid() and exists(select 1 from diary_entries d where d.id=entry_id and app_private.employee_access(d.employee_id)) and (kind='commento' or app_private.direction()));
do $$ declare t text; begin foreach t in array array['goals','training_records'] loop
 execute format('create policy operational_read on public.%I for select to authenticated using(app_private.employee_access(employee_id))',t);
 execute format('create policy operational_insert on public.%I for insert to authenticated with check(app_private.employee_access(employee_id) and app_private.role() in (''direzione'',''responsabile''))',t);
 execute format('create policy operational_update on public.%I for update to authenticated using(app_private.employee_access(employee_id) and app_private.role() in (''direzione'',''responsabile'')) with check(app_private.employee_access(employee_id) and app_private.role() in (''direzione'',''responsabile''))',t);
end loop;end $$;
create policy plan_read on annual_plans for select to authenticated using(app_private.employee_access(employee_id) and app_private.direction());
create policy plan_manage on annual_plans for all to authenticated using(app_private.employee_access(employee_id) and app_private.direction()) with check(app_private.employee_access(employee_id) and app_private.direction() and author_id=auth.uid());
create policy audit_read on audit_log for select to authenticated using(company_id=app_private.company() and app_private.direction());
create policy revision_read on revision_history for select to authenticated using(company_id=app_private.company() and app_private.direction());

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('personnel','personnel',false,15728640,array['application/pdf']) on conflict(id) do update set public=false,file_size_limit=15728640,allowed_mime_types=array['application/pdf'];
create policy personnel_read on storage.objects for select to authenticated using(bucket_id='personnel' and exists(select 1 from public.documents d where d.storage_path=name and app_private.sensitive(d.employee_id)));
create policy personnel_insert on storage.objects for insert to authenticated with check(bucket_id='personnel' and exists(select 1 from public.documents d where d.storage_path=name and d.uploaded_by=auth.uid() and app_private.sensitive(d.employee_id)));
-- No object UPDATE policy: originals cannot be overwritten. Cleanup is a privileged retention procedure.

create or replace function public.record_sensitive_access(document uuid) returns text language plpgsql security definer set search_path='' as $$
declare d public.documents; c uuid;
begin
 select * into d from public.documents where id=document;
 if d.id is null or not app_private.sensitive(d.employee_id) then raise exception 'Documento non autorizzato'; end if;
 select company_id into c from public.employees where id=d.employee_id;
 insert into public.audit_log(company_id,actor_id,table_name,record_id,action) values(c,auth.uid(),'documents',d.id::text,'DOWNLOAD_REQUEST');
 return d.storage_path;
end $$;
revoke all on function public.record_sensitive_access(uuid) from public;
grant execute on function public.record_sensitive_access(uuid) to authenticated;

-- Tight grants: audit/history can only be written by security-definer triggers.
grant select,insert,update,delete on all tables in schema public to authenticated;
revoke insert,update,delete on public.audit_log,public.revision_history from authenticated;
revoke all on all tables in schema public from anon;
grant usage,select on all sequences in schema public to authenticated;
revoke all on all functions in schema app_private from public;
grant execute on all functions in schema app_private to authenticated;

create index employees_location_idx on employees(location_id,status);
create index diary_employee_date_idx on diary_entries(employee_id,event_on desc);
create index evaluations_employee_period_idx on evaluations(employee_id,period desc);
create index payroll_employee_period_idx on payroll(employee_id,year desc,month desc);
create index documents_employee_idx on documents(employee_id);
create index audit_company_date_idx on audit_log(company_id,occurred_at desc);
create index absence_employee_date_idx on absences(employee_id,starts_on);

create or replace function public.record_data_access(employee uuid,resource text) returns void language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if resource not in ('annual_report','payroll','absences','attendance','employee_private','contracts','documents','export') then raise exception 'Tipo accesso non valido'; end if;
 if not app_private.sensitive(employee) then raise exception 'Accesso riservato non autorizzato'; end if;
 select company_id into c from public.employees where id=employee;
 insert into public.audit_log(company_id,actor_id,table_name,record_id,action) values(c,auth.uid(),resource,employee::text,'READ_REQUEST');
end $$;
revoke all on function public.record_data_access(uuid,text) from public;
grant execute on function public.record_data_access(uuid,text) to authenticated;

create or replace function app_private.orphan_document(doc uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.documents d where d.id=doc and d.uploaded_by=auth.uid() and app_private.sensitive(d.employee_id) and not exists(select 1 from storage.objects o where o.bucket_id='personnel' and o.name=d.storage_path) and not exists(select 1 from public.payroll p where p.document_id=d.id))
$$;
revoke all on function app_private.orphan_document(uuid) from public;
grant execute on function app_private.orphan_document(uuid) to authenticated;
create policy document_cleanup on public.documents for delete to authenticated using(app_private.orphan_document(id));

-- Optional employee photographs remain private, separately from PDF personnel files.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('employee-photos','employee-photos',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy employee_photo_read on storage.objects for select to authenticated using(bucket_id='employee-photos' and exists(select 1 from public.employees e where e.photo_path=name and app_private.employee_access(e.id)));
create policy employee_photo_insert on storage.objects for insert to authenticated with check(bucket_id='employee-photos' and exists(select 1 from public.employees e where e.photo_path=name and app_private.sensitive(e.id)));
create policy employee_photo_update on storage.objects for update to authenticated using(bucket_id='employee-photos' and exists(select 1 from public.employees e where e.photo_path=name and app_private.sensitive(e.id))) with check(bucket_id='employee-photos' and exists(select 1 from public.employees e where e.photo_path=name and app_private.sensitive(e.id)));

-- Preserve operational transfers without relying on every client to write history.
alter table public.employment_history add column recorded_at timestamptz not null default now();
create or replace function app_private.record_employment_assignment() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.employment_history(employee_id,location_id,job_title,starts_on) values(new.id,new.location_id,new.job_title,new.hired_on);
 elsif new.location_id is distinct from old.location_id or new.job_title is distinct from old.job_title then
  update public.employment_history set ends_on=greatest(starts_on,current_date-1) where employee_id=new.id and ends_on is null;
  insert into public.employment_history(employee_id,location_id,job_title,starts_on) values(new.id,new.location_id,new.job_title,greatest(new.hired_on,current_date));
 end if;
 return null;
end $$;
revoke all on function app_private.record_employment_assignment() from public;
create trigger employment_assignment_history after insert or update on public.employees for each row execute function app_private.record_employment_assignment();

create trigger audit_company_change after update on public.companies for each row execute function app_private.audit_change();
create or replace function app_private.validate_goal() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' and new.owner_id is distinct from auth.uid() and auth.uid() is not null then raise exception 'Responsabile obiettivo non valido'; end if;
 if TG_OP='UPDATE' and (new.employee_id,new.owner_id,new.created_at) is distinct from (old.employee_id,old.owner_id,old.created_at) then raise exception 'Identità obiettivo immutabile'; end if;
 if new.evaluation_id is not null and not exists(select 1 from public.evaluations e where e.id=new.evaluation_id and e.employee_id=new.employee_id) then raise exception 'Valutazione obiettivo non corrisponde al dipendente'; end if;
 return new;
end $$;
revoke all on function app_private.validate_goal() from public;
create trigger goal_validation before insert or update on public.goals for each row execute function app_private.validate_goal();

create or replace function app_private.guard_document_author() returns trigger language plpgsql set search_path='' as $$
begin
 if auth.uid() is not null and new.uploaded_by is distinct from auth.uid() then raise exception 'Autore documento non autorizzato'; end if;
 return new;
end $$;
revoke all on function app_private.guard_document_author() from public;
create trigger document_author before insert on public.documents for each row execute function app_private.guard_document_author();
-- Document originals and their hashes/ownership/path are immutable after insertion.
revoke update on public.documents from authenticated;
