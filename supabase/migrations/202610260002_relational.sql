-- Relational catalogs and criteria/scores, maintained from the validated parent write API.
-- JSON columns remain the canonical input so every write passes the original validators.
create table public.roles (
 key text primary key,
 label text not null unique
);
insert into public.roles(key,label) values
 ('direzione','Direzione'),('hr','HR / Amministrazione'),('responsabile','Responsabile di punto vendita');
alter table public.profiles add constraint profiles_role_catalog_fkey foreign key(role) references public.roles(key);

create table public.evaluation_criteria (
 template_id uuid not null references public.evaluation_templates(id) on delete cascade,
 key text not null,
 label text not null,
 weight numeric not null check(weight>0 and weight<=100),
 primary key(template_id,key)
);
create table public.evaluation_scores (
 evaluation_id uuid not null references public.evaluations(id) on delete cascade,
 template_id uuid not null,
 criterion_key text not null,
 score integer not null check(score between 1 and 5),
 primary key(evaluation_id,criterion_key),
 foreign key(template_id,criterion_key) references public.evaluation_criteria(template_id,key)
);

create or replace function app_private.sync_evaluation_criteria() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.evaluation_criteria(template_id,key,label,weight)
 select new.id, item->>'key', item->>'label', (item->>'weight')::numeric
 from jsonb_array_elements(new.criteria) item;
 return null;
end $$;
create trigger normalized_template_criteria after insert on public.evaluation_templates for each row execute function app_private.sync_evaluation_criteria();

create or replace function app_private.sync_evaluation_scores() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.evaluation_scores where evaluation_id=new.id;
 insert into public.evaluation_scores(evaluation_id,template_id,criterion_key,score)
 select new.id,new.template_id,entry.key,(entry.value::numeric)::integer
 from jsonb_each_text(new.scores) entry where entry.value is not null;
 return null;
end $$;
create trigger normalized_evaluation_scores after insert or update on public.evaluations for each row execute function app_private.sync_evaluation_scores();

-- Backfill installations that already contain templates and evaluations.
insert into public.evaluation_criteria(template_id,key,label,weight)
 select t.id,item->>'key',item->>'label',(item->>'weight')::numeric
 from public.evaluation_templates t cross join lateral jsonb_array_elements(t.criteria) item;
insert into public.evaluation_scores(evaluation_id,template_id,criterion_key,score)
 select e.id,e.template_id,item.key,(item.value::numeric)::integer
 from public.evaluations e cross join lateral jsonb_each_text(e.scores) item where item.value is not null;

alter table public.roles enable row level security;
alter table public.evaluation_criteria enable row level security;
alter table public.evaluation_scores enable row level security;
create policy role_catalog_read on public.roles for select to authenticated using(app_private.company() is not null);
create policy normalized_criteria_read on public.evaluation_criteria for select to authenticated using(exists(select 1 from public.evaluation_templates t where t.id=template_id));
create policy normalized_scores_read on public.evaluation_scores for select to authenticated using(exists(select 1 from public.evaluations e where e.id=evaluation_id));
revoke all on public.roles,public.evaluation_criteria,public.evaluation_scores from public,anon,authenticated;
grant select on public.roles,public.evaluation_criteria,public.evaluation_scores to authenticated;
revoke all on function app_private.sync_evaluation_criteria() from public,anon,authenticated;
revoke all on function app_private.sync_evaluation_scores() from public,anon,authenticated;
create index evaluation_scores_template_idx on public.evaluation_scores(template_id,criterion_key);
