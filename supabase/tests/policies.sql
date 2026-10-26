\set ON_ERROR_STOP on
begin;
create function pg_temp.assert_true(ok boolean,label text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'PASS: %',label;end$$;
create function pg_temp.expect_denied(query text,label text) returns void language plpgsql as $$begin begin execute query; exception when others then raise notice 'PASS: % (%)',label,SQLERRM;return;end;raise exception 'FAIL: % was permitted',label;end$$;
insert into auth.users(id,email) values
('00000000-0000-0000-0000-000000000001','direzione@example.test'),
('00000000-0000-0000-0000-000000000002','manager@example.test'),
('00000000-0000-0000-0000-000000000003','hr@example.test');
insert into companies(id,name) values('10000000-0000-0000-0000-000000000001','Azienda fittizia');
insert into profiles(id,company_id,full_name,role) values
('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Direzione fittizia','direzione'),
('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Responsabile fittizio','responsabile'),
('00000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','HR fittizio','hr');
insert into locations(id,company_id,name) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Sede assegnata'),
('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','Sede non assegnata');
insert into user_locations values('00000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000001');
insert into employees(id,company_id,location_id,employee_code,first_name,last_name,job_title,hired_on) values
('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','TEST001','Anna','Esempio','Sala','2024-01-01'),
('30000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','TEST002','Luca','Fittizio','Sala','2024-01-01');
insert into evaluation_templates(id,company_id,name,criteria) values('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Standard','[{"key":"service","label":"Servizio","weight":25},{"key":"procedures","label":"Procedure","weight":25},{"key":"team","label":"Collaborazione","weight":20},{"key":"punctuality","label":"Puntualità documentata","weight":15},{"key":"autonomy","label":"Autonomia","weight":15}]');
set local role authenticated;
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000002","aal":"aal1"}';
select pg_temp.assert_true((select count(*) from employees)=1,'manager vede solo sede assegnata');
select pg_temp.assert_true((select count(*) from payroll)=0,'manager non legge dati retributivi');
select pg_temp.expect_denied($q$insert into employee_private(employee_id,email) values('30000000-0000-0000-0000-000000000001','x@example.test')$q$,'manager non scrive dati personali riservati');
select pg_temp.expect_denied($q$insert into documents(id,employee_id,kind,filename,storage_path,sha256) values('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','busta_paga','p.pdf','30000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001.pdf',repeat('a',64))$q$,'manager non carica documenti');
with changed as (update profiles set role='direzione' where id=auth.uid() returning id) select pg_temp.assert_true((select count(*) from changed)=0,'manager non può promuoversi');
insert into evaluations(id,employee_id,template_id,period,scores,comment,status) values('60000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-01-01','{"service":5,"procedures":4,"team":3,"punctuality":4,"autonomy":5}','Valutazione fattuale del servizio.','inviata');
select pg_temp.assert_true((select weighted_score=4.20 from evaluations where id='60000000-0000-0000-0000-000000000001'),'punteggio ponderato 4.20');
select pg_temp.assert_true((select count(*) from roles)=3,'catalogo ruoli relazionale disponibile a utente assegnato');
select pg_temp.assert_true((select count(*) from evaluation_criteria where template_id='40000000-0000-0000-0000-000000000001')=5,'criteri normalizzati sincronizzati dal modello');
select pg_temp.assert_true((select count(*) from evaluation_scores where evaluation_id='60000000-0000-0000-0000-000000000001')=5,'punteggi normalizzati sincronizzati da valutazione');
select pg_temp.assert_true((select sum(s.score*c.weight)/100 from evaluation_scores s join evaluation_criteria c on c.template_id=s.template_id and c.key=s.criterion_key where s.evaluation_id='60000000-0000-0000-0000-000000000001')=4.20,'query relazionale riproduce media ponderata');
select pg_temp.expect_denied($q$update evaluation_scores set score=1 where evaluation_id='60000000-0000-0000-0000-000000000001'$q$,'nessuna scrittura diretta sui punteggi normalizzati');
select pg_temp.expect_denied($q$insert into evaluation_criteria(template_id,key,label,weight) values('40000000-0000-0000-0000-000000000001','injected','Criterio illecito',100)$q$,'nessuna scrittura diretta sui criteri normalizzati');
select pg_temp.expect_denied($q$update roles set label='Privilegi falsificati' where key='responsabile'$q$,'catalogo ruoli non modificabile da utenti applicativi');
insert into evaluations(id,employee_id,template_id,period,scores,status) values('60000000-0000-0000-0000-000000000003','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-03-01','{"service":1.0}','bozza');
select pg_temp.assert_true((select score=1 from evaluation_scores where evaluation_id='60000000-0000-0000-0000-000000000003' and criterion_key='service'),'bozza parziale normalizza punteggio numerico intero');
update evaluations set scores='{"service":4}' where id='60000000-0000-0000-0000-000000000003';
select pg_temp.assert_true((select score=4 from evaluation_scores where evaluation_id='60000000-0000-0000-0000-000000000003' and criterion_key='service'),'modifica bozza sincronizza punteggio relazionale');


select pg_temp.expect_denied($q$insert into evaluations(employee_id,template_id,period,scores,comment,status) values('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-01-01','{"service":5,"procedures":4,"team":3,"punctuality":4,"autonomy":5}','Duplicato','inviata')$q$,'nessuna doppia valutazione mensile');
with changed as (update evaluations set comment='Modifica dopo invio' where id='60000000-0000-0000-0000-000000000001' returning id) select pg_temp.assert_true((select count(*) from changed)=0,'manager non modifica valutazione inviata');
select pg_temp.expect_denied($q$insert into goals(employee_id,owner_id,description) values('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Obiettivo con autore falsificato')$q$,'manager non falsifica responsabile obiettivo');
insert into diary_entries(id,employee_id,location_id,event_on,category,description) values('70000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','2026-01-10','positivo','Ha gestito autonomamente un reclamo.');
update diary_entries set description='Ha gestito autonomamente il reclamo documentato.' where id='70000000-0000-0000-0000-000000000001';
select pg_temp.expect_denied($q$update diary_entries set verification_status='verificata' where id='70000000-0000-0000-0000-000000000001'$q$,'manager non verifica la propria nota');
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000001","aal":"aal1"}';
select pg_temp.expect_denied($q$insert into employee_private(employee_id,email) values('30000000-0000-0000-0000-000000000001','x@example.test')$q$,'direzione senza MFA non accede dati sensibili');
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000001","aal":"aal2"}';
select pg_temp.assert_true((select count(*) from employees)=2,'direzione vede tutte le sedi');
select pg_temp.expect_denied($q$insert into evaluation_templates(company_id,name,criteria) values('10000000-0000-0000-0000-000000000001','Pesi mancanti','[{"key":"x","label":"Criterio"}]')$q$,'modello senza pesi respinto');
select pg_temp.expect_denied($q$insert into evaluation_templates(company_id,name,criteria) values('10000000-0000-0000-0000-000000000001','Pesi errati','[{"key":"x","label":"Criterio","weight":50}]')$q$,'modello con pesi diversi da 100 respinto');
select pg_temp.expect_denied($q$update evaluation_templates set criteria='[{"key":"x","label":"Criterio","weight":100}]' where id='40000000-0000-0000-0000-000000000001'$q$,'modello pubblicato conserva versione immutabile');
select pg_temp.expect_denied($q$insert into audit_log(company_id,table_name,record_id,action) values('10000000-0000-0000-0000-000000000001','fake','fake','fake')$q$,'utenti non possono falsificare audit');
select pg_temp.expect_denied($q$insert into evaluations(employee_id,template_id,period,status,not_evaluable) values('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-02-01','inviata',true)$q$,'non valutabile richiede motivazione');
insert into evaluations(employee_id,template_id,period,status,not_evaluable,reason) values('30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-02-01','inviata',true,'Attività insufficiente per valutazione attendibile');
select pg_temp.assert_true((select weighted_score is null from evaluations where period='2026-02-01'),'non valutabile senza punteggio');

update evaluations set status='convalidata' where id='60000000-0000-0000-0000-000000000001';
select pg_temp.expect_denied($q$update evaluations set comment='Modifica illegittima' where id='60000000-0000-0000-0000-000000000001'$q$,'anche direzione non modifica direttamente convalidata');
insert into evaluations(id,employee_id,template_id,period,scores,comment,status,revision,supersedes_id,rectification_reason) values('60000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','2026-01-01','{"service":4,"procedures":4,"team":4,"punctuality":4,"autonomy":4}','Correzione di un errore materiale.','convalidata',2,'60000000-0000-0000-0000-000000000001','Errore materiale verificato');
select pg_temp.assert_true((select count(*) from evaluations where employee_id='30000000-0000-0000-0000-000000000001' and period='2026-01-01')=2,'rettifica conserva valutazione originale');
select pg_temp.assert_true((select count(*) from evaluation_scores where evaluation_id in ('60000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002'))=10,'rettifica crea punteggi distinti e conserva punteggi originali');
select pg_temp.assert_true((select count(*) from revision_history where table_name='diary_entries')=1,'storico nota conserva precedente versione');
update diary_entries set verification_status='verificata' where id='70000000-0000-0000-0000-000000000001';
insert into absences(employee_id,kind,starts_on,ends_on,hours) values('30000000-0000-0000-0000-000000000001','assenza_tutelata','2026-01-01','2026-01-10',40);
select pg_temp.assert_true((select weighted_score=4.20 from evaluations where id='60000000-0000-0000-0000-000000000001'),'assenze tutelate non alterano punteggi');
insert into documents(id,employee_id,kind,filename,storage_path,sha256) values('50000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','busta_paga','fittizia.pdf','30000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001.pdf',repeat('a',64));
select pg_temp.expect_denied($q$update documents set sha256=repeat('c',64)$q$,'hash e metadati originali documento immutabili');
select pg_temp.expect_denied($q$insert into documents(id,employee_id,uploaded_by,kind,filename,storage_path,sha256) values('50000000-0000-0000-0000-000000000009','30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','busta_paga','falso.pdf','30000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000009.pdf',repeat('c',64))$q$,'autore documento non falsificabile');
insert into storage.objects(bucket_id,name) values('personnel','30000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000001.pdf');
insert into payroll(employee_id,document_id,year,month,net_amount,status,ordinary_confirmed) values('30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',2026,1,1500,'verificata',true);
select pg_temp.expect_denied($q$update payroll set net_amount=1600$q$,'rettifica netto richiede motivazione');
update payroll set net_amount=1600,correction_reason='Errore di trascrizione documentato';
select pg_temp.assert_true((select count(*) from revision_history where table_name='payroll')=1,'rettifica stipendio mantiene storico');
select pg_temp.expect_denied($q$insert into documents(employee_id,kind,filename,storage_path,sha256) values('30000000-0000-0000-0000-000000000001','busta_paga','fittizia.pdf','bad',repeat('a',64))$q$,'documento duplicato o percorso invalido respinto');
select pg_temp.assert_true((select record_sensitive_access('50000000-0000-0000-0000-000000000001')) is not null,'download autorizzato registrato');
select pg_temp.assert_true((select count(*) from audit_log where action='DOWNLOAD_REQUEST')=1,'audit download');
reset role;
select pg_temp.assert_true((select public=false from storage.buckets where id='personnel'),'bucket documenti privato');
set local role authenticated;
select pg_temp.assert_true((select count(*) from employment_history where employee_id='30000000-0000-0000-0000-000000000001')=1,'assunzione genera storico sede');
update employees set job_title='Responsabile sala' where id='30000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select count(*) from employment_history where employee_id='30000000-0000-0000-0000-000000000001')=2,'cambio mansione conserva storico');
insert into documents(id,employee_id,kind,filename,storage_path,sha256) values('50000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','busta_paga','periodo_non_riconosciuto.pdf','30000000-0000-0000-0000-000000000001/50000000-0000-0000-0000-000000000002.pdf',repeat('b',64));
insert into payroll(employee_id,document_id,year,month) values('30000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000002',null,null);
select pg_temp.assert_true((select year is null and month is null from payroll where document_id='50000000-0000-0000-0000-000000000002'),'periodo non riconosciuto resta nullo in bozza');
select pg_temp.expect_denied($q$update payroll set status='verificata',net_amount=1300 where document_id='50000000-0000-0000-0000-000000000002'$q$,'non confermare periodo non riconosciuto');
update payroll set year=2026,month=1,net_amount=1300 where document_id='50000000-0000-0000-0000-000000000002';
select pg_temp.expect_denied($q$update payroll set status='verificata' where document_id='50000000-0000-0000-0000-000000000002'$q$,'non confermare doppio stipendio stesso periodo');
update employees set photo_path=id::text||'/avatar.webp';
insert into storage.objects(bucket_id,name) select 'employee-photos',photo_path from employees;
set local request.jwt.claims='{"sub":"00000000-0000-0000-0000-000000000002","aal":"aal2"}';
select pg_temp.assert_true((select count(*) from payroll)=0,'manager non legge busta paga esistente anche con MFA');
select pg_temp.assert_true((select count(*) from evaluation_scores where evaluation_id='60000000-0000-0000-0000-000000000002')=0,'punteggi normalizzati ereditano autorizzazioni valutazioni');
select pg_temp.assert_true((select count(*) from documents)=0,'manager non legge metadati documenti');
select pg_temp.assert_true((select count(*) from storage.objects where bucket_id='personnel')=0,'manager non legge oggetti privati');
select pg_temp.assert_true((select count(*) from storage.objects where bucket_id='employee-photos')=1,'manager vede soltanto foto della propria sede');
select pg_temp.assert_true((select count(*) from absences)=0,'manager non legge causali protette');
select pg_temp.expect_denied($q$select record_sensitive_access('50000000-0000-0000-0000-000000000001')$q$,'manager non scarica PDF via RPC');
with changed as (update evaluations set comment='Manomissione' where id='60000000-0000-0000-0000-000000000001' returning id) select pg_temp.assert_true((select count(*) from changed)=0,'manager non altera convalidata');
update diary_entries set description='Fatto rettificato dopo una verifica della Direzione.' where id='70000000-0000-0000-0000-000000000001';
select pg_temp.assert_true((select verification_status='da_verificare' from diary_entries where id='70000000-0000-0000-0000-000000000001'),'modifica fatti del responsabile invalida verifica precedente');
select pg_temp.expect_denied($q$update diary_entries set description='Nuova modifica con verifica falsificata',verification_status='verificata' where id='70000000-0000-0000-0000-000000000001'$q$,'modifica contenuto non permette cambio stato esplicito non autorizzato');
reset role;
select pg_temp.assert_true((select count(*) from revision_history where table_name='diary_entries' and record_id='70000000-0000-0000-0000-000000000001')=3,'verifica e modifica successiva mantengono revisioni dei fatti');
rollback;
