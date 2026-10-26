# Database, autorizzazioni e primo accesso

Applicare in ordine le migrazioni `supabase/migrations` attraverso Supabase CLI (`supabase db push`) oppure SQL Editor con un account proprietario del progetto. Il progetto deve trovarsi in una regione UE; verificare DPA, impostazioni dei backup e retention prima di inserire dati reali.

## Primo account Direzione

1. Creare l'utente da Supabase Authentication, invitarlo e verificare la sua email. Disabilitare le registrazioni pubbliche nelle impostazioni Auth; l'applicazione non offre registrazione aperta.
2. Copiare **solo l'UUID** dell'utente. Nel SQL Editor amministrativo eseguire, sostituendo UUID e ragione sociale:

```sql
begin;
insert into public.companies(name) values ('Gianno') returning id;
-- Usare l'UUID azienda restituito e quello dell'utente Auth:
insert into public.profiles(id,company_id,full_name,role,evaluations_access)
values ('UUID_UTENTE', 'UUID_AZIENDA', 'Direzione Gianno', 'direzione', true);
commit;
```

3. Accedere e registrare un fattore TOTP dalla pagina di autenticazione/MFA. Le scritture amministrative, i dati riservati, la gestione degli utenti e la convalida richiedono una sessione Supabase `aal2`. L'app non contiene una chiave `service_role`.
4. Creare le sedi dalla piattaforma. Creare gli altri utenti con invito Auth, quindi assegnare i profili e le sedi dalla sezione autorizzazioni. Un utente Auth senza profilo attivo non vede dati. Il responsabile può avere più righe in `user_locations`.
5. Creare un modello di valutazione con pesi totali 100. Un modello già creato non permette di cambiare criteri/versione: inserire una nuova versione, conservando i riferimenti storici.

Nessun trigger assegna privilegi basandosi su `user_metadata`: i ruoli possono essere assegnati esclusivamente dalla Direzione autenticata con MFA oppure dall'amministratore SQL durante il bootstrap. La creazione e l'invito Auth richiedono accesso alla console Supabase; non esporre una service-role key al browser.

## Contratti di sicurezza

- RLS attiva su tutte le tabelle. Il ruolo `responsabile` vede solo dipendenti delle proprie sedi e le valutazioni da lui compilate. La Direzione vede tutte le valutazioni, HR solo con `evaluations_access` esplicito.
- Contatti personali e data di nascita in `employee_private`; contratti, assenze, presenze, documenti e stipendi sono in tabelle separate, accessibili esclusivamente a HR/Direzione con MFA. La sede operativa e la mansione sono disponibili ai responsabili assegnati.
- Nessun ruolo applicativo può modificare `audit_log` o `revision_history`. Ogni modifica genera un evento; gli aggiornamenti mantengono il valore precedente. Lo storico completo, che può contenere dati riservati, è leggibile solo dalla Direzione con MFA.
- Le valutazioni convalidate sono immutabili. La rettifica crea un'altra riga con `revision`, `supersedes_id` e motivazione; l'originale rimane. La constraint impedisce doppie revisioni dello stesso mese. I report devono usare solo la revisione più recente, senza sommare le precedenti.
- `weighted_score` è calcolato dal database esclusivamente dai criteri della versione associata. Assenze e note non contribuiscono al punteggio. Le valutazioni non attendibili hanno `not_evaluable=true`, motivazione e punteggio nullo.
- I documenti sono nel bucket privato `personnel`, solo PDF massimo 15 MiB. Il percorso è `<employee_uuid>/<document_uuid>.pdf`. Inserire prima i metadati, poi caricare senza overwrite; sha256 evita duplicati per dipendente. Non è disponibile una policy di sovrascrittura o cancellazione per gli utenti applicativi.
- Chiamare `record_sensitive_access(document uuid)` prima di emettere un URL firmato breve. Le modifiche e le richieste di download sono nel registro applicativo. Per una registrazione centralizzata anche delle letture SQL dirette o dei riutilizzi di URL firmati, attivare e conservare gli audit log di Supabase/PostgreSQL e Storage; il solo audit applicativo non sostituisce i log infrastrutturali. Un URL firmato resta utilizzabile fino a scadenza: mantenere TTL breve e non inserirlo in log condivisi.

## Test locali delle policy

```sh
bash tests/database/run.sh
```

Il runner crea un container PostgreSQL 17 temporaneo, emula solo gli schemi infrastrutturali `auth`/`storage`, applica le migrazioni reali e usa il ruolo PostgreSQL `authenticated` per esercitare effettivamente RLS e trigger. Nessun test usa il proprietario del database per simulare richieste utente. I dati sono completamente fittizi e vengono annullati con rollback. Il container viene rimosso anche in caso di errore. Docker e accesso al registry dell'immagine sono necessari.

Questo verifica PostgreSQL e le policy; prima della produzione eseguire inoltre test end-to-end con un progetto Supabase di collaudo per Auth TOTP, refresh sessione, signed URL, Storage, upload e revoca utenti. Non usare gli stub di test su Supabase.

## Revoca, backup, conservazione

Per un utente uscente impostare `profiles.active=false`, rimuovere le assegnazioni, revocare le sessioni da Auth e bloccare l'account nella console. Le funzioni RLS ricontrollano il profilo attivo ad ogni operazione. Gli URL documentali già firmati scadono con il TTL.

`companies.retention_months` registra la politica approvata; **non cancella automaticamente dati**. Prima di abilitare un job di cancellazione, concordare i termini distinti per categoria documentale, le eccezioni legali e l'eventuale conservazione necessaria a contenziosi. Le richieste privacy sono registrate in `data_requests`. La cancellazione delle copie nello storage richiede una procedura amministrativa coordinata con i metadati e i backup.

Abilitare backup gestiti/PITR secondo il piano Supabase e copiare separatamente lo storage privato: il backup SQL non contiene i PDF. Provare periodicamente il ripristino in un progetto isolato, confrontando dipendenti, valutazioni/revisioni, audit e hash dei PDF. Verificare RLS e accessi dopo il restore prima di abilitare account reali.

## Staging buste paga e fotografie

Una busta paga non ancora verificata può avere anno e mese nulli: non indovinare il periodo corrente quando l'estrazione non lo riconosce. La conferma richiede anno, mese e importo netto. L'unicità dipendente/anno/mese/tipologia vale per le sole righe `verificata`; più bozze possono essere confrontate prima della conferma. La conservazione dell'hash impedisce di caricare due volte lo stesso PDF per lo stesso dipendente. Il record documentale senza oggetto Storage e senza busta paga collegata può essere eliminato dal caricatore autorizzato, per ripulire un caricamento fallito; un originale archiviato non è eliminabile dall'app.

Il bucket separato `employee-photos` è privato e ammette soltanto JPEG, PNG e WebP fino a 5 MiB. Impostare `employees.photo_path` prima di caricare il file; solo HR/Direzione con MFA può scriverlo. La lettura delle foto segue le autorizzazioni operative alle sedi. Non usare URL pubblici per fotografie del personale.

Ogni inserimento dipendente crea automaticamente una riga in `employment_history`; un cambio di sede o mansione chiude l'assegnazione aperta e ne crea una nuova, datata al giorno della modifica (oppure alla data di assunzione se futura). `recorded_at` distingue cambi multipli nello stesso giorno. Per trasferimenti retrodatati, usare una procedura amministrativa approvata, verificando e rettificando esplicitamente gli intervalli; l'interfaccia non deve fingere una precisione temporale assente.

## Cataloghi e dati relazionali delle valutazioni

La migrazione `202610260002_relational.sql` introduce il catalogo `roles` (`key`, `label`), referenziato da `profiles.role`, e le tabelle `evaluation_criteria` (`template_id`, `key`, `label`, `weight`) ed `evaluation_scores` (`evaluation_id`, `template_id`, `criterion_key`, `score`). Le chiavi esterne impediscono punteggi privi di un criterio valido. Le righe sono adatte a query SQL analitiche e report relazionali.

Il punto di scrittura canonico resta il modello/versione e la valutazione parent: `evaluation_templates.criteria` ed `evaluations.scores` vengono validati dai trigger originari, quindi trigger `SECURITY DEFINER` sincronizzano le righe relazionali nello stesso commit. Il backfill iniziale popola i dati esistenti. Gli utenti applicativi non possono inserire, alterare o eliminare direttamente catalogo, criteri e punteggi normalizzati: non possono aggirare l'immutabilità dei modelli/convalide né il controllo della somma dei pesi. Una rettifica conserva le righe dei punteggi originali e ne crea altre associate alla nuova valutazione.

Le policy di lettura dei criteri e dei punteggi interrogano i rispettivi parent protetti da RLS: un responsabile non può leggere punteggi relativi a valutazioni altrui o di sedi non assegnate. Il catalogo ruoli contiene esclusivamente tre codici e relative etichette, leggibili solo da utenti con profilo aziendale attivo, senza dati personali o autorizzazioni a singoli utenti.

La migrazione `202610260003_diary_verification.sql` lega la verifica del diario ai fatti effettivamente esaminati: se un responsabile modifica data, categoria, descrizione o azione intrapresa, lo stato torna automaticamente a `da_verificare`. Il precedente contenuto e lo stato verificato restano nello storico. Una modifica esplicita non autorizzata dello stato continua a essere respinta prima del reset automatico; la Direzione può rettificare i fatti nell'ambito della propria verifica, con audit invariato.
