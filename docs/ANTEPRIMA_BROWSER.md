# Aprire GIANNO PEOPLE nel browser, senza terminale

Questa procedura prepara un'anteprima **separata dalla produzione**, con dati esclusivamente fittizi. Non richiede di scrivere o incollare SQL. Le operazioni tecniche sono già nel repository e si avviano con un pulsante GitHub. Le diciture delle console possono cambiare leggermente.

L'ambiente cloud Codex non fornisce un link pubblico di preview. Pubblicare l'ambiente Codex conserva il lavoro ma non pubblica il sito. Il repository GitHub contiene il codice, non un sito navigabile. GitHub Pages non è adatto a questa app, perché richiede un server Next.js, autenticazione e database.

Per la prova proponiamo **Supabase Free + Render Free**. Usare esclusivamente piani contrassegnati Free, senza aggiungere risorse a pagamento. Se un servizio propone un upgrade, richiede un piano pagante o le quote gratuite sono terminate, fermarsi e valutarlo prima con il proprietario. Non è necessario acquistare un dominio.

## 1. Creare Supabase DEMO

1. Aprire [Supabase](https://supabase.com/dashboard) e registrarsi, anche tramite GitHub.
2. Creare un'organizzazione sul piano **Free**, poi **New project**.
3. Nome: **Gianno People DEMO**. Scegliere una regione UE, ad esempio Frankfurt. Generare e conservare la password del database in un gestore password. Non inviarla in chat.
4. Confermare la creazione solo se il piano è Free. Attendere che il progetto risulti attivo.
5. In **Authentication → Users → Add user → Create user**, creare il primo account con email `direzione.demo@example.test` e una password personale di prova di almeno 12 caratteri. Se presente, abilitare **Auto confirm user**. L'indirizzo è fittizio e non riceve email.
6. Copiare l'UUID del nuovo utente dalla sua scheda. Non è una password.
7. Per provare anche gli altri ruoli, creare nello stesso modo `hr.demo@example.test` e `responsabile.demo@example.test` e conservare i relativi UUID. È facoltativo al primo avvio.

Nelle impostazioni **Authentication**, disattivare **Allow new users to sign up / Enable sign ups**, lasciando attivo l’accesso email/password. Gli utenti si aggiungono soltanto dalla console amministrativa; non è prevista registrazione pubblica.

Non caricare anagrafiche o documenti reali. Questi account sono esclusivamente per questa demo. Non riutilizzarli in produzione.

## 2. Preparare il database con un pulsante GitHub

1. In Supabase premere **Connect** e selezionare **Session pooler**. Copiare la connection string PostgreSQL della porta **5432**, mantenendo il segnaposto `[YOUR-PASSWORD]` se presente. Non usare Transaction pooler/porta 6543 o il collegamento IPv6 diretto.
2. Aprire [Gianno213/Gianno](https://github.com/Gianno213/Gianno), poi **Settings → Secrets and variables → Actions → New repository secret**.
3. Aggiungere `DEMO_DATABASE_URL`: incollare la connection string appena copiata. Aggiungere `DEMO_DATABASE_PASSWORD`: inserire la password database conservata al punto precedente. I valori si inseriscono soltanto nei campi riservati GitHub, mai in file, commenti o messaggi.
4. Tornare alla scheda **Actions** del repository. Se GitHub chiede di abilitare i workflow, consentirlo solo entro la propria quota gratuita. Non attivare fatturazione o aumenti di budget. Il workflow non crea risorse esterne o servizi a pagamento.
5. Scegliere **Prepara anteprima DEMO → Run workflow**, branch **main**.
6. Nel campo di conferma scrivere **DEMO** e incollare l'UUID Direzione. Inserire anche gli UUID HR e responsabile se creati. Sono valori di configurazione, non codice.
7. Premere **Run workflow** e attendere la spunta verde.

Il pulsante applica le migrazioni e inserisce un'azienda DEMO, due sedi, tre collaboratori fittizi e il modello di valutazione. Non modifica le password degli account. Se rilanciato, conserva le prove già fatte. Rifiuta un database che contiene un'altra azienda o tabelle estranee; usare comunque un progetto nuovo dedicato.

Se il workflow segnala un errore TLS, non disattivare la verifica dei certificati. Scaricare il certificato CA dalle impostazioni database Supabase e inserirlo nel secret opzionale `DEMO_DATABASE_CA`, oppure chiedere assistenza riportando solo il codice errore. Non condividere la connection string o la password.

La connessione amministrativa resta nel workflow GitHub; **non va inserita nell'app Render**. Il job usa una transazione: un errore annulla la preparazione.

## 3. Creare la preview Render Free

1. Aprire [Render](https://dashboard.render.com/) e registrarsi con GitHub.
2. Collegare soltanto il repository **Gianno213/Gianno** quando viene chiesto l'accesso GitHub.
3. Selezionare **New → Blueprint**, scegliere il repository e il branch **main**. Render legge il file `render.yaml` già preparato.
4. Controllare che venga creato un solo servizio web **gianno-people-demo**, piano **Free**, regione **Frankfurt**. Non aggiungere un database Render: usiamo Supabase. L'aggiornamento automatico dal repository è disattivato.
5. Compilare i due campi richiesti con i valori del progetto Supabase DEMO:

| Campo Render                           | Dove trovare il valore                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Project URL, da Connect/API o Project Settings → Data API                                                                     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chiave **Publishable** da Project Settings → API Keys; se il progetto mostra soltanto le chiavi legacy, usare **anon/public** |

Non usare la chiave `service_role`, una secret key, la password del database o i secret GitHub. La chiave pubblicabile identifica il progetto; le sessioni e RLS proteggono i dati.

6. Premere **Deploy Blueprint** solo se il piano è Free. Attendere lo stato **Live**.
7. Nella scheda del servizio copiare l'indirizzo HTTPS assegnato da Render. Questo sarà il link effettivo dell'anteprima; non è già stato creato da Codex.
8. In **Environment** aggiungere `NEXT_PUBLIC_SITE_URL` con quell'indirizzo completo, quindi salvare e ricostruire il servizio con **Manual Deploy → Deploy latest commit** se necessario.
9. In Supabase **Authentication → URL Configuration**, impostare **Site URL** sullo stesso indirizzo HTTPS e aggiungere tra i redirect l'indirizzo seguito da `/auth/callback`. Salvare.

## 4. Aprire e provare l'app

1. Aprire il link HTTPS della scheda Render nel browser.
2. Accedere con `direzione.demo@example.test` e la password scelta in Supabase.
3. Configurare l'autenticazione a due fattori: premere **Configura o verifica MFA**, scansionare il QR con un'app Authenticator e inserire il codice temporaneo. Conservare l'accesso al dispositivo. Nessun costo è richiesto dall'app per TOTP.
4. Verificare la presenza dell'azienda **GIANNO PEOPLE — DEMO**, delle due sedi e dei collaboratori con nomi dimostrativi.
5. Provare una nota nel diario, una valutazione mensile, un obiettivo, il report PDF e un documento PDF esclusivamente fittizio.
6. Se è stato creato il responsabile demo, uscire e accedere con quell'account: deve vedere soltanto la sede Centro e non deve accedere a retribuzioni o documenti riservati. HR e Direzione richiedono MFA.
7. Riaprire l'app e verificare che le informazioni salvate siano ancora presenti.

I piani gratuiti possono sospendere i servizi per inattività: il primo accesso può essere lento. Non offrono le garanzie di continuità e backup necessarie all'uso aziendale. Il recupero password via email non va provato con gli indirizzi `example.test`, che non sono caselle reali.

## 5. Dopo il collaudo

Conservare la demo separata. Solo dopo approvazione di costi e configurazione creare un progetto Supabase **di produzione** in UE, hosting HTTPS adatto al carico, account nominativi riservati, SMTP, backup del database e copia separata dei PDF, con prova di ripristino. Prima di dati reali completare le verifiche di sicurezza/privacy/giuslavoristiche documentate. Non copiare account o dati demo in produzione.

Stime e voci da approvare: [COSTI_SERVIZI.md](COSTI_SERVIZI.md).
