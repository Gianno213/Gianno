# GIANNO PEOPLE

Gestionale HR in italiano per il gruppo Gianno: Next.js App Router, TypeScript, Tailwind, Supabase Auth/PostgreSQL/Storage. Il repository contiene codice applicativo, migrazioni e test; non contiene credenziali o dati reali. La configurazione di un progetto Supabase è necessaria per usare i flussi autenticati. La schermata di configurazione senza credenziali non è una modalità dimostrativa con salvataggi simulati.

L’albero e i confini di sicurezza sono descritti in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Anteprima senza terminale

Per provare il gestionale dal browser con soli dati fittizi, seguire [la guida con i passaggi nelle console web](docs/ANTEPRIMA_BROWSER.md). Il repository include un pulsante GitHub Actions per preparare il database DEMO e un blueprint Render Free. Nessun servizio esterno è già stato creato o attivato da queste istruzioni. [Costi indicativi e regole di spesa](docs/COSTI_SERVIZI.md).

## Installazione

Richiede Node.js 24 e npm 11; Docker è utile per i test isolati del database.

```bash
npm ci --cache /workspace/.npm-cache
cp .env.example .env.local
npm run dev
```

Fuori da Codex è possibile scegliere una diversa cache npm. Inserire in `.env.local` URL e chiave pubblicabile del proprio progetto Supabase. La chiave pubblicabile identifica il progetto, mentre l'accesso ai dati è limitato dalla sessione utente e dalle policy RLS. Non aggiungere la chiave `service_role` al runtime web.

Per uno stack di sviluppo interamente locale, eseguire `bash scripts/local-supabase.sh start` con Docker disponibile e seguire [docs/LOCAL_INTEGRATION.md](docs/LOCAL_INTEGRATION.md). Il primo avvio scarica immagini consistenti e può richiedere diversi minuti. Il comando preserva un eventuale `.env.local` preesistente. Il collaudo usa soltanto dati fittizi.

## Supabase e database

1. Creare un progetto Supabase in una regione UE, registrando titolare, responsabili, accordi e regione effettiva.
2. Applicare in ordine i file in `supabase/migrations` tramite Supabase CLI (`supabase link`, `supabase db push`) o SQL Editor con utenza amministrativa. Non usare i file `supabase/tests/bootstrap.sql` in produzione: sono esclusivamente stub per i test locali.
3. Configurare Auth con Site URL dell'app e redirect autorizzato `/auth/callback`. In produzione usare HTTPS, disabilitare iscrizioni pubbliche e creare/invitare gli utenti dalla console amministrativa. Configurare il proprio provider SMTP, i template invito/recupero descritti in `docs/OPERATIONS.md` e i limiti antiabuso.
4. Creare il primo account Direzione e la relativa azienda/profilo con la procedura in [docs/OPERATIONS.md](docs/OPERATIONS.md). L'app non assegna privilegi in base all'indirizzo email né al primo accesso.
5. Registrare il fattore TOTP dall'interfaccia. Direzione e HR devono completare MFA per le operazioni riservate.
6. Accedere come Direzione, inserire i punti vendita nella sezione Sedi e assegnare i responsabili alle sedi. Inserire i dipendenti con dati fittizi per le prime verifiche.

Le migrazioni creano schema, controlli e bucket documentale privato. Non rendere pubblico il bucket. Per gli utenti aggiuntivi creare gli account Auth tramite strumenti amministrativi Supabase e assegnare profili/sedi secondo le istruzioni operative; non esporre un endpoint anonimo per il provisioning.

## Avvio e verifiche

```bash
npm run typecheck
npm test
npm run test:db
npm run build
npm run test:browser
npm start
```

I test DB richiedono Docker e usano un PostgreSQL isolato con stub Auth/Storage, senza dati aziendali. Verificano i controlli SQL ma non sostituiscono un collaudo della piattaforma Supabase reale. Il test funzionale di Auth, MFA, Storage e link firmati va eseguito sul progetto configurato con utenti dei tre ruoli.

## Flusso operativo

La Direzione definisce sedi, collaboratori e criteri; i responsabili vedono soltanto le sedi assegnate. Il diario raccoglie fatti di lavoro e non genera punteggi. La valutazione è mensile, usa criteri versionati e può essere non valutabile con motivazione. La convalida blocca la modifica diretta; le rettifiche conservano la versione precedente.

Le buste paga sono PDF privati. L'estrazione testuale avviene nel processo server, senza fornitori AI. I valori estratti devono essere corretti/confermati da una persona autorizzata. I PDF scansionati senza testo richiedono inserimento manuale: OCR locale è un'estensione opzionale, non va confuso con un riconoscimento già disponibile. Le medie separano mensilità ordinarie e aggiuntive e riportano il numero di mesi disponibili.

Per importazioni utilizzare file CSV UTF-8 con le intestazioni richieste dall'interfaccia; Excel può esportare CSV. I file `.xlsx` nativi non sono necessari al flusso iniziale. Importare prima un piccolo campione fittizio, controllare gli esiti e poi procedere con il file completo.

## Distribuzione

Distribuire su hosting compatibile con Next.js Node runtime (non solo esportazione statica), preferibilmente in UE. Impostare le variabili `.env.example` nel gestore sicuro dell'hosting, configurare HTTPS e URL Auth. Eseguire `npm ci`, migrazioni e `npm run build` prima dell'attivazione. Le migrazioni sono un'operazione amministrativa separata, non eseguita a ogni richiesta.

La pipeline `.github/workflows/ci.yml` esegue test, controlli SQL/RLS, build e smoke browser. Il `Dockerfile` multistadio esegue il runtime come utente non root; fornire gli identificativi pubblici Supabase e Site URL come build arg. Ricostruire il pacchetto se cambiano le variabili `NEXT_PUBLIC_*`.

Non usare cache pubbliche sulle pagine HR o sugli export. Pianificare backup database e backup oggetti separati, restore di prova, patch dipendenze e monitoraggio errori privo di contenuti personali. Consultare [docs/OPERATIONS.md](docs/OPERATIONS.md) e [docs/PRIVACY.md](docs/PRIVACY.md) prima di dati reali.

## Stato e limiti di collaudo

Il codice deve essere collaudato con il progetto Supabase e gli utenti reali autorizzati prima dell'uso operativo. I risultati effettivamente ottenuti nell'ambiente di sviluppo sono registrati in [docs/VALIDATION.md](docs/VALIDATION.md). Nessuna pubblicazione, conformità normativa o ripristino è implicita nella presenza del codice.
