# Recupero password: Supabase standard, senza SMTP personalizzato

Il recupero supporta il template predefinito Supabase basato su `{{ .ConfirmationURL }}`. Non occorre modificare il template o acquistare SMTP. Restano applicabili i limiti di invio del servizio email Supabase Free.

## Aggiornare Render dal browser

1. Aprire il servizio **gianno-people-demo** in Render.
2. In **Environment** verificare `NEXT_PUBLIC_SITE_URL` = `https://gianno-people-demo.onrender.com` (senza percorsi). Se manca, il server può usare `RENDER_EXTERNAL_URL` fornito da Render. Le chiavi Supabase pubbliche già configurate restano quelle del progetto demo; nessuna service-role è necessaria.
3. Selezionare **Manual Deploy → Deploy latest commit** sul branch `main` e attendere **Live**. Il deploy deve eseguire la build, non soltanto riavviare il vecchio pacchetto.
4. Non cambiare piano o aggiungere servizi. L'aggiornamento usa il servizio esistente; rimangono le quote del piano scelto.

## Configurare Supabase dal browser

In **Authentication → URL Configuration**:

- **Site URL**: `https://gianno-people-demo.onrender.com`.
- **Redirect URLs**: autorizzare esattamente `https://gianno-people-demo.onrender.com/auth/callback` e `https://gianno-people-demo.onrender.com/auth/callback?next=/auth/password`.

Salvare. Lasciare il template standard con **ConfirmationURL**; non sono richieste modifiche email o SMTP. Non aggiungere wildcard verso domini esterni e non disattivare MFA o le altre protezioni Auth.

## Provare il recupero

1. Dopo il deploy richiedere una **nuova** email da “Password dimenticata?”. I link già consumati o scaduti non diventano riutilizzabili dopo un deploy.
2. Aprire il collegamento nello **stesso browser/profilo** usato per la richiesta, senza passare a un'altra finestra in incognito. Le richieste dell'app mantengono PKCE: il codice richiede il relativo verificatore locale. Se il browser è diverso, richiedere una nuova email da quello che si intende usare; non viene aggirato PKCE.
3. La pagina verifica il collegamento e apre **Imposta la password**. I token vengono rimossi dalla barra degli indirizzi.
4. Se l'account ha già un fattore MFA, premere **Verifica MFA e continua**, inserire il codice Authenticator e tornare automaticamente al modulo password. Il fattore non viene rimosso dal recupero; se il dispositivo è perso, serve la procedura amministrativa autorizzata.
5. Impostare e confermare una password di almeno 12 caratteri. Dopo il salvataggio la sessione viene terminata: accedere di nuovo con la nuova password.

Non inviare a nessuno i link email completi, token, password o chiavi. Per un problema basta descrivere il messaggio generico mostrato dall'app e l'ora del tentativo.

## Gestione tecnica

- Il callback è una pagina client accessibile prima della sessione: gestisce il frammento `#access_token=…&refresh_token=…&type=recovery` del flusso implicito standard, senza tentare di leggerlo sul server.
- L'URL viene ripulito **prima** di inizializzare il client Supabase, evitando una gara con la rilevazione automatica dell'SDK. La sessione viene salvata dal client SSR negli stessi cookie usati dal server e l'identità viene confermata con `getUser()`.
- I callback `?code=…` restano PKCE e usano `exchangeCodeForSession`; quelli `token_hash` usano `verifyOtp`. Nessun ripiego disattiva il controllo del verificatore.
- Se un link standard ricade sul Site URL e il frammento raggiunge la pagina di accesso, il bridge lo inoltra al callback sullo stesso sito.
- Sono ammesse soltanto destinazioni interne prestabilite. Link scaduti, già usati, credenziali mancanti o miste e token non verificati producono un errore generico, senza riflettere dettagli del provider.
- Pagina e azione password verificano la sessione; l'azione impone anche MFA quando richiesta dal fattore già registrato. Supabase continua ad applicare i propri controlli sul cambio password, incluso l'eventuale requisito di riautenticazione.
- Nessun token o credenziale viene scritto nei log applicativi. Le route Auth usano `Referrer-Policy: no-referrer`; i log di sviluppo escludono URL sensibili e argomenti delle Server Functions. Gli eventuali log/access tracker dell'hosting vanno mantenuti privi di query e frammenti di autenticazione.

## Verifiche ripetibili in sviluppo

- `npm test`: percorsi standard/PKCE/token_hash, rifiuti, redirect, richiesta generica senza enumerazione account, sessione/MFA e controllo server.
- `npm run typecheck` e `npm run build`.
- Con lo stack locale e l'app avviati: `node tests/integration/password-recovery.mjs`. Il test rifiuta endpoint remoti, crea e cancella solo un account sintetico, genera link reali tramite GoTrue senza inviare email e verifica dal browser sessioni cookie, cambio password, nuovo accesso, link monouso, token_hash, ricaduta sul Site URL e mantenimento del TOTP. Non mostra URL o credenziali, neppure quando una verifica fallisce.

Il collaudo locale non invia email dal progetto Supabase pubblicato e non sostituisce la prova finale della consegna con il proprio account dopo il deploy Render.

Collaudo locale del 27 ottobre 2026: 101 test automatici superati, TypeScript e build di produzione riusciti, cinque scenari di recupero reale verificati nel browser (standard, monouso, token_hash, Site URL, TOTP). Superati anche i 21 controlli integrati preesistenti e le quattro prove autenticate desktop/mobile; le quattro prove senza configurazione sono intenzionalmente escluse dalla modalità autenticata. Il deploy sul servizio Render pubblicato resta da eseguire dalla sua console.
