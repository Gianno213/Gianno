# Costi indicativi e autorizzazioni

Non è stato attivato alcun servizio a pagamento. Le cifre seguenti sono **stime di pianificazione**, non un preventivo né tariffe verificate in tempo reale. I listini ufficiali non erano raggiungibili dalla rete di questo ambiente durante la verifica. Prima di sottoscrivere controllare il prezzo mostrato nella propria console, imposte, cambio, quote e condizioni. I prezzi in USD non includono IVA.

| Servizio                            | Prova con dati fittizi                                                                                    | Produzione: riferimento indicativo                                                                                         |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Supabase: PostgreSQL, Auth, Storage | Free, entro le quote disponibili                                                                          | Pro da circa **25 USD/mese**; progetti/compute aggiuntivi e consumi possono aumentare il totale                            |
| Render: hosting Next.js e HTTPS     | Free, con sospensione e limiti                                                                            | Starter da circa **7 USD/mese**; un'istanza con più memoria può portare l'hosting a **25 USD/mese** o oltre                |
| Vercel, alternativa a Render        | Il piano Hobby è destinato a uso personale non commerciale; non lo proponiamo per il gestionale aziendale | Pro da circa **20 USD/mese per postazione**, più eventuali consumi                                                         |
| Email transazionali SMTP            | Nessun invio necessario con account demo creati manualmente                                               | Possibili quote gratuite; prevedere **0–15 USD/mese** secondo fornitore e volume                                           |
| Backup dei PDF e monitoraggio       | Solo dati demo, nessuna garanzia di produzione                                                            | Voce separata, indicativamente **0–10 USD/mese** per volumi ridotti; da progettare e quotare                               |
| Dominio                             | Incluso indirizzo HTTPS del provider                                                                      | Usando un sottodominio aziendale esistente può non esserci un acquisto aggiuntivo; nuovo dominio spesso **10–25 EUR/anno** |

Per la demo l'obiettivo è **0 USD/mese**, solo se i piani Free e le quote dell'account risultano effettivamente disponibili. Controllare anche la quota GitHub Actions prima di eseguire i workflow; non abilitare spesa aggiuntiva.

Per produzione, il riferimento minimo Supabase Pro + Render Starter è circa **32 USD/mese**; con un server più capiente circa **50 USD/mese**, prima di email, backup file, imposte e superamenti. Un budget preliminare complessivo di **35–75 USD/mese** può essere ragionevole per un piccolo utilizzo, ma va confermato con volumi e requisiti reali. Con Vercel Pro il riferimento parte da circa **45 USD/mese** per una postazione, prima degli extra.

I backup database previsti dal piano scelto vanno verificati per frequenza e conservazione. **Non includono automaticamente i file PDF di Storage**. PITR, retention più lunga, progetti separati a pagamento e servizi di backup aggiuntivi richiedono un preventivo specifico e approvazione prima dell'attivazione.

## Regola di spesa

Per ora: soltanto piani Free, niente upgrade, nessun add-on, nessun acquisto dominio. Se una console non offre un'opzione gratuita, fermarsi. Prima della produzione presentare piano, regione, canone, limiti, consumi extra e modalità di backup; attendere autorizzazione esplicita per ogni servizio a pagamento.

Fonti da consultare prima della scelta: [Supabase](https://supabase.com/pricing), [Render](https://render.com/pricing), [Vercel](https://vercel.com/pricing), [GitHub Actions](https://docs.github.com/en/billing/managing-billing-for-your-products/managing-billing-for-github-actions/about-billing-for-github-actions).
