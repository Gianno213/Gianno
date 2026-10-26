# Gestione operativa

## Primo account e utenti

Seguire [database.md](database.md) per creare l'azienda e associare l'UUID Auth al primo profilo Direzione. Creare/invitare gli account Auth dalla console amministrativa Supabase, con iscrizioni pubbliche disattivate. La Direzione associa poi l'UUID dell'utente a ruolo e sedi nella sezione Impostazioni. Non è richiesto un token amministrativo nel runtime Next.js.

Configurare un provider SMTP affidabile e Site URL dell'app; autorizzare `/auth/callback` e i redirect di recupero password sul dominio corretto. Il recupero password deve rispondere nello stesso modo per email esistenti e inesistenti. Usare password uniche e TOTP; conservare un processo amministrativo verificato per recupero del fattore perso, senza bypass pubblici.

Per responsabili con più sedi aggiungere le singole assegnazioni. Rivedere periodicamente i profili e revocare tempestivamente gli accessi cessati: disattivare il profilo, rimuovere le assegnazioni e revocare le sessioni in Auth. Non basta nascondere il menu. Direzione/HR completano MFA prima dell'accesso ai dati riservati.

## Importazioni

File CSV UTF-8, con separatore virgola o punto e virgola riconosciuto dal parser. Date `YYYY-MM-DD`; ore decimali con punto. Limite 2 MB e 2.000 righe per richiesta. L'utente deve essere HR/Direzione con MFA.

Dipendenti: `employee_code,first_name,last_name,job_title,location_id,hired_on,status`. `location_id` è l'UUID di una sede già creata; `status` può essere `attivo`, `cessato`, `sospeso`.

Presenze: `employee_id,work_date,hours,source`. `employee_id` è l'UUID del collaboratore già creato; le presenze non sono geolocalizzazione o monitoraggio continuo. I dati di importazione vengono validati prima dell'inserimento multiplo. Una violazione dei vincoli fa fallire la singola operazione, senza ignorare silenziosamente le righe.

Excel può aprire gli export e salvare import in CSV UTF-8. Non sono presenti connettori automatici verso sistemi paghe o rilevazione presenze.

## Documenti e buste paga

Caricare solo PDF relativi al dipendente selezionato. L'hash impedisce duplicati identici; il tipo di mensilità e il periodo verificati impediscono registrazioni definitive doppie. Controllare il PDF originale, l'identità, il periodo, il netto e la tipologia prima della conferma. Le informazioni non riconosciute restano da compilare; non usare il lordo come netto.

Il parser locale non invia dati a fornitori AI. Un PDF senza testo, corrotto, protetto o con impaginazione non riconosciuta richiede verifica manuale. OCR locale non è incluso. Le rettifiche dei dati confermati richiedono motivazione e mantengono lo storico. L'originale non viene sovrascritto.

Download: autenticazione e autorizzazione vengono ricontrollate prima di emettere il link breve. Non copiare link firmati in sistemi condivisi: sono utilizzabili fino alla scadenza anche dopo una revoca. I log infrastrutturali di accesso vanno configurati su Supabase, in aggiunta all'audit applicativo.

## Backup e ripristino

1. Attivare backup gestiti/PITR secondo il piano e definire RPO/RTO documentati.
2. Salvare separatamente gli oggetti Storage privati e i relativi hash: un dump PostgreSQL non contiene i PDF.
3. Proteggere e limitare l'accesso alle copie; definire retention per backup, database e documenti.
4. Provare il restore in un progetto isolato, con invii email disattivati e utenti fittizi/controllati.
5. Confrontare conteggi, relazioni, valutazioni e revisioni, audit e hash degli oggetti. Provare accessi negati e URL firmati con i tre ruoli.
6. Registrare data, tempi, anomalie, responsabile e correzioni. Un backup non ripristinato in prova non è una procedura verificata.

`retention_months` memorizza la politica configurata ma non avvia cancellazioni automatiche. Un eventuale job di eliminazione va progettato tenendo conto di obblighi retributivi/fiscali, richieste di accesso, contenziosi e backup. La sezione richieste privacy registra i casi; la decisione e l'esecuzione autorizzata restano umane.

## Rilascio

Usare Node.js 24 e `npm ci` con lockfile. Applicare migrazioni a un progetto di staging prima della produzione, eseguire test e build. Configurare HTTPS, URL Auth/SMTP, MFA, regione, backup, audit e allarmi. Non includere `.env.local`, chiavi o PDF nei commit o nei log dell'hosting.

Il consenso al rilascio richiede esito positivo dei flussi con tre utenti reali di collaudo: responsabile autorizzato a una sola sede, responsabile con più sedi, HR e Direzione con MFA; includere prove di revoca e tentativi di chiamata diretta alle API/Storage.

## Template email Auth per inviti e recupero

Per inviti amministrativi e recupero funzionanti anche senza un verificatore PKCE già presente nel browser, configurare in Supabase Auth i template email con link al callback applicativo:

```html
<a
  href="{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&amp;type=invite&amp;next=/auth/password"
  >Imposta la password aziendale</a
>
```

Nel template di recupero sostituire `type=invite` con `type=recovery`. Il backend verifica il token tramite Supabase e ammette come destinazione successiva soltanto la pagina di password. Impostare Site URL e redirect autorizzati sul dominio HTTPS effettivo. Collaudare gli inviti e le email tramite SMTP di staging prima dell'uso reale; il test Docker non dimostra la consegna di email.

Impostare in Auth almeno 12 caratteri per le nuove password, protezioni contro abusi/credenziali compromesse secondo il piano disponibile e cambio password sicuro. L'ambiente locale usa password fittizie generate, non account di produzione.
