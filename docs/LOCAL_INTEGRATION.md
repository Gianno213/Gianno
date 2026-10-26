# Collaudo integrato locale Supabase

Il collaudo integrato usa i servizi ufficiali **Supabase Auth (GoTrue), PostgREST, Supabase Storage e Kong**, con PostgreSQL 17 Alpine e dati fittizi. Le migrazioni infrastrutturali sono eseguite dai servizi Auth/Storage reali; non vengono usati gli stub SQL dei test unitari delle policy. JWT e MFA sono verificati dai servizi effettivi.

Questo runtime locale essenziale è distinto da un progetto Supabase gestito: non include Studio, Realtime, Edge Functions, SMTP di produzione, backup gestiti o garanzie di disponibilità. Il collaudo non prova distribuzione, invio email reale o ripristino remoto.

## Avvio riproducibile

Prerequisiti: Docker con plugin Compose, Node.js24, dipendenze npm del progetto. Non servono credenziali esterne.

```sh
bash scripts/local-supabase.sh start
node tests/integration/supabase.mjs
bash scripts/local-supabase.sh status
# Al termine, conservando il database e i PDF locali:
bash scripts/local-supabase.sh stop
```

Il helper genera credenziali casuali esclusivamente per i servizi locali e configura porte vincolate a `127.0.0.1`. I file di configurazione e i dati persistenti rimangono nella cartella ignorata `.local-supabase/`, esclusa anche dal contesto Docker dell'applicazione. La cartella è privata (`0700`); i file JSON/env con le chiavi sono `0600`. I file di inizializzazione montati nei container sono leggibili dai rispettivi utenti container e protetti dalla cartella privata sul sistema host.

`.env.local` viene creato **solo se assente**, inserendo esclusivamente URL e chiave pubblica locali. Le chiavi amministrative non vengono copiate nel runtime Next.js. I log e lo status con informazioni riservate sono privati sotto `/tmp`: non stamparli né condividerli.

Il helper attende le tabelle create dai servizi Auth e Storage, applica le migrazioni applicative in transazioni e registra quelle già eseguite. Richiama poi gli endpoint di salute dei tre servizi. Un secondo avvio conserva database, oggetti e `.env.local`; non reinizializza i dati. Le migrazioni già applicate non devono essere riscritte per distribuire aggiornamenti: aggiungere nuovi file SQL.

## Test delle API e del browser

Il runner `tests/integration/supabase.mjs` rifiuta URL diversi da localhost. Crea un'azienda fittizia e tre account con password casuali. Le credenziali non vengono stampate; per il test browser sono conservate in `/tmp/gianno-local-accounts.json` con permessi privati.

Verifica accesso password, TOTP reale per Direzione/HR, autorizzazioni per sede, rifiuto di paghe/assenze ai responsabili, calcolo e blocco delle valutazioni convalidate, diario/obiettivi, caricamento PDF privato, rifiuto URL pubblico, download firmato autorizzato e rettifica con storico. Le operazioni usano JWT autentici, senza emulare le claim MFA.

Dopo l'avvio locale ricostruire Next.js, poiché le variabili pubbliche del client sono incluse nel bundle:

```sh
npm run build
GIANNO_AUTH_BROWSER=1 npm run test:browser -- --workers=1
```

La suite autenticata richiede la variabile esplicita e il fixture privato; altrimenti è dichiarata non eseguita. La suite di configurazione senza Supabase è separata e richiede un build senza credenziali. Il singolo worker evita il riutilizzo contemporaneo dello stesso codice TOTP tra i due viewport. I test registrano nuovi episodi fittizi per verificare che il salvataggio sopravviva al reload.

## CLI Supabase opzionale

Il primo tentativo con lo stack completo della CLI ha incontrato un pull/registrazione dell'immagine PostgreSQL Supabase che non si completava nel Docker `vfs` di questo ambiente. Per evitare ulteriori download inutili il runtime locale usa l'immagine ufficiale PostgreSQL Alpine già verificata, con i servizi ufficiali Supabase separati.

Per operazioni CLI su un progetto gestito è disponibile `bash scripts/local-supabase.sh install-cli`: installa la versione2.75.0 da release ufficiale con SHA256 fissato, in `/workspace/.tools`, senza modificare HOME né disabilitare TLS. `GIANNO_TOOLS_DIR` permette di scegliere una directory scrivibile fuori da Codex. Il helper CLI opzionale è `scripts/supabase-cli.sh`; il normale avvio di collaudo non dipende da questa CLI.

## Conservazione e produzione

I dati fittizi restano disponibili per esaminare l'interfaccia. Il ripristino del solo codice non prova il ripristino di database o PDF: preservare anche `.local-supabase/data` quando si conserva questo ambiente e provarne il ripristino separatamente. Non usare questo runtime come hosting produttivo; configurare il progetto UE gestito, SMTP, backup, HTTPS e verifiche riportate nel README e nei documenti operativi.
