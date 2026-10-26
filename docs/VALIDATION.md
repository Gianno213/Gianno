# Esiti del collaudo — 26 ottobre 2026

Ambiente: Node.js 24, npm 11, Linux, Chromium di sistema, PostgreSQL 17. Tutti i dati e gli utenti di collaudo sono fittizi. Nessun collegamento a un database aziendale o caricamento di dati reali.

| Verifica eseguita                                             | Esito                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------- |
| Installazione ripetibile `npm ci` con lockfile                | Superata                                                             |
| `npm run typecheck` (generazione tipi Next e TypeScript)      | Superata                                                             |
| `npm test`                                                    | 69 test superati, 10 file                                            |
| `npm run test:db` su PostgreSQL reale con stub Auth/Storage   | 56 verifiche SQL/RLS superate, tutte le 3 migrazioni                 |
| API reali locali Auth/REST/Storage                            | 21 verifiche integrate superate                                      |
| Build Next.js di produzione                                   | Superata                                                             |
| Browser senza configurazione: desktop e smartphone            | 4 verifiche superate                                                 |
| Browser autenticato con Supabase locale: desktop e smartphone | 4 verifiche superate                                                 |
| Audit delle dipendenze npm                                    | Nessuna vulnerabilità segnalata al momento della verifica            |
| Arresto/riavvio stack locale e avvio ripetuto                 | Superati; dati e `.env.local` conservati, migrazioni non riapplicate |

Le due modalità browser sono distinte: in modalità autenticata le 4 prove di configurazione sono saltate intenzionalmente, mentre nella modalità senza configurazione sono saltate le 4 prove autenticate. Entrambe le modalità sono state realmente eseguite sul relativo build. Gli skip non sono conteggiati come test superati.

## Comportamenti verificati

- Responsabile isolato alle sedi assegnate e impossibilitato a leggere retribuzioni, PDF paghe e assenze protette, anche via API/SQL.
- Login password dei tre ruoli e MFA TOTP reale per Direzione/HR. Il JWT aal2 è emesso da Auth dopo challenge, non simulato dai test integrati.
- Punteggi ponderati calcolati sul modello versionato; le assenze non cambiano il punteggio.
- Convalida immutabile, rettifiche conservate, criteri/punteggi normalizzati sincronizzati e scritture dirette negate.
- Modifica di una nota verificata da parte del responsabile: verifica invalidata e storico mantenuto.
- PDF caricato e conservato privatamente; accesso pubblico e accesso responsabile negati; download firmato autorizzato con confronto dei byte originali.
- Paghe confermate e rettificate con storico; valori numerici vuoti rifiutati; zero esplicito consentito.
- Medie su mesi effettivi con mensilità aggiuntive separate; parsing prudente del netto locale e segnalazione ambiguità.
- Diario salvato dal browser e visibile dopo ricaricamento; dati di altra sede assenti.
- Direzione autenticata con MFA: netto fittizio corretto visibile e report PDF reale generato dall'API.
- Pagine di accesso e flussi autenticati senza overflow orizzontale a 1440×1000 e 390×844.
- Export con paginazione completa, limite 10.000 righe, interruzione su errori e protezione contro formule CSV; report senza sezioni riservate per impostazione predefinita.

## Distinzione degli ambienti

Il test SQL usa PostgreSQL e stub infrastrutturali soltanto per esercitare schema/RLS in isolamento. Il collaudo integrato usa invece immagini ufficiali GoTrue, PostgREST e Storage API con Kong e PostgreSQL 17 locale, inizializzati con le vere migrazioni dei servizi. Non usa gli stub per Auth o Storage e non aggira MFA/RLS. Lo stack completo della CLI Supabase non è stato utilizzato: la relativa immagine database pesante non ha completato l'avvio in questo runtime. Lo stack locale leggero è quello effettivamente verificato e riproducibile tramite `scripts/local-supabase.sh`.

Il collaudo locale non prova il progetto Supabase gestito di produzione, la pubblicazione del sito, la consegna SMTP, il ripristino dei backup o il ripristino di questo ambiente in un nuovo task. Le istruzioni di installazione e avvio sono salvate nella bozza delle impostazioni cloud; pubblicazione e attivazione restano operazioni del prodotto.

## Limiti e verifiche prima dell'uso reale

- Configurare progetto Supabase/hosting HTTPS in regione UE, URL Auth, template email, SMTP e account aziendali. Eseguire nuovamente test end-to-end su staging gestito.
- Verificare backup database e file, restore, retention per categoria, revoche, audit infrastrutturali e gestione incidenti.
- Completare revisione sicurezza, verifiche GDPR/giuslavoristiche ed eventuale DPIA secondo il contesto reale.
- OCR locale opzionale non implementato: scansioni da verificare/inserire manualmente. Import/export disponibili in CSV UTF-8 compatibile Excel; non è presente un parser `.xlsx` nativo.
- Il `Dockerfile` e la pipeline CI sono predisposti; non sono stati eseguiti un deploy remoto o un build dell'immagine applicativa Docker. Il pacchetto standalone Next.js è stato avviato e verificato nei browser.
