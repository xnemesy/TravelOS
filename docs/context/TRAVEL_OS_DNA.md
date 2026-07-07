# TRAVEL_OS_DNA.md

> Questo è il documento che, tra un anno, deve impedire a chiunque — umano o agente AI — di trasformare Travel OS in "un trip planner qualsiasi". Non descrive funzionalità: descrive l'identità del prodotto. Se una decisione tecnica sembra ragionevole ma contraddice qualcosa scritto qui, è questo documento ad avere l'ultima parola, non la comodità del momento.

## Cosa rende Travel OS diverso

Non è la lista di feature — è **come** vengono prese le decisioni dentro il prodotto:

1. **Tre livelli per ogni luogo, mai fusi.** Un dato provider aggiornato non può mai sovrascrivere ciò che Travel OS ha curato editorialmente o ciò che l'utente ha vissuto e scritto di suo pugno. Vedi [DIFFERENTIATORS.md](../vision/DIFFERENTIATORS.md#1-tre-livelli-di-conoscenza-per-ogni-luogo-mai-fusi-tra-loro).
2. **Un motore fatto di regole leggibili, non un algoritmo opaco.** Ogni giorno composto è la somma di decisioni ispezionabili — ognuna con una spiegazione testuale, un peso, una motivazione (`confidence`, `reason`). Nessuna decisione del composer è mai "perché sì".
3. **Memoria osservata, distinta dalla memoria dichiarata, per sempre.** Quello che l'utente scrive nel diario e quello che l'utente effettivamente fa sono due segnali diversi, che si alimentano a vicenda ma non collassano mai in un solo modello.
4. **Resilienza come principio, non come gestione errori.** Ogni dipendenza esterna (provider di dati, rete) può fallire senza mai rompere l'esperienza — degrado a un fallback deterministico, mai un errore bloccante in faccia all'utente.

## Cosa Travel OS non deve mai diventare

- **Un chatbot con un prompt generico spacciato per intelligenza di viaggio.** Se un giorno arriva un "AI Concierge" che risponde a domande libere senza aver mai letto un Traveler DNA reale, quello non è Travel OS — è un wrapper attorno a un LLM che ha rubato il nome del prodotto. Vedi §AI Concierge sotto.
- **Un aggregatore di prenotazioni che tratta il viaggiatore come un carrello della spesa.** Nessuna feature futura (booking, pagamenti) deve mai spostare il centro del prodotto dalla composizione umana della giornata alla transazione.
- **Un algoritmo che ottimizza per numero di esperienze invece che per sostenibilità umana della giornata.** Il giorno in cui "più luoghi visitati" diventa la metrica di successo invece di "giornata bilanciata", il prodotto ha perso la propria identità — vedi §Journey Composer.
- **Un sistema che fonde livelli di dato per comodità di implementazione.** "Tanto è più semplice avere un solo modello Place" è esattamente il ragionamento che il `PlaceMergeEngine` esiste per rifiutare strutturalmente.
- **Un prodotto che nasconde i propri limiti invece di documentarli.** Un bug preesistente scoperto durante un refactoring si documenta con un ADR e un test che lo blocca (vedi ADR-016) — non si maschera con un fix silenzioso che nessuno potrà mai capire retrospettivamente.

## Principi non negoziabili

1. **Gli Engine orchestrano, i Domain Service calcolano.** Questa separazione non è stile di codice — è ciò che rende ogni pezzo di logica di dominio testabile senza mock, riproducibile, e ispezionabile in isolamento. Comprometterla per velocità di sviluppo è un debito che si paga esponenzialmente man mano che il sistema cresce.
2. **L'Event Bus trasporta solo fatti realmente accaduti.** Un Domain Fact deve significare sempre la stessa cosa, per sempre — perché in futuro un motore che apprende dal comportamento (Traveler DNA) leggerà esattamente quello stream. Un evento finto oggi è una bugia che un sistema futuro imparerà come verità.
3. **La UI non conosce mai il dominio direttamente.** Se un componente React importa un repository o un Engine invece di un hook, l'incapsulamento che rende il dominio sostituibile e testabile si rompe silenziosamente, un import alla volta.
4. **Nessuna decisione dell'algoritmo è irreversibile per l'utente.** `isLocked`, gli anchor `HARD`/`SOFT`, la possibilità di drag&drop manuale: l'automazione compone intorno alla volontà umana, non la sostituisce mai senza possibilità di controllo.
5. **I numeri prima delle parole, sempre.** Qualunque motore che deriva intelligenza dal comportamento dell'utente produce dati strutturati e deterministici. Il linguaggio naturale è un livello a valle, separato, sostituibile — mai il motore stesso.

## Filosofia del Journey Composer

Il Composer non pianifica per l'utente — compone **con** quello che l'utente ha scelto. "Non inventa mai luoghi esterni: lavora esclusivamente sui luoghi resi disponibili" non è una limitazione tecnica, è un impegno di prodotto: Travel OS non decide al posto del viaggiatore cosa vedere, decide come renderlo vivibile. Una giornata "riuscita" per questo motore non è quella con più esperienze possibili — è quella con pause, ritmo, non più di 1-2 momenti "must-see" per non affaticare, e margine per l'imprevisto. Se in futuro qualcuno propone di ottimizzare il Composer per massimizzare il numero di luoghi visitati per giorno, quella proposta va misurata contro questo paragrafo prima che contro qualunque metrica di engagement.

## Filosofia del Rule Engine

Ogni regola ha un nome, un peso dichiarato, e produce una spiegazione testuale del proprio giudizio — non un punteggio muto. Questo non è un dettaglio implementativo: è ciò che rende possibile, per un umano o un agente AI, capire *perché* un luogo è stato posizionato a una certa ora e non a un'altra, senza dover decompilare un modello. Aggiungere una nuova regola deve sempre significare aggiungere una nuova voce esplicita alla pipeline — mai infilare un'eccezione condizionale dentro una regola esistente che ne annacqua lo scopo dichiarato. Il giorno in cui il Rule Engine viene sostituito (in parte o del tutto) da un modello statistico o da un LLM, quella sostituzione deve essere valutata contro la perdita di ispezionabilità che comporta — non decisa solo sulla base della qualità media dell'output.

## Filosofia dell'AI Concierge

L'AI Concierge non esiste oggi, e questo è intenzionale, non un ritardo. Il suo prerequisito architetturale è un Traveler DNA maturo — un profilo comportamentale numerico, derivato da fatti osservati, non da un questionario o da un prompt. Quando l'AI Concierge verrà costruito, dovrà **leggere** il Traveler DNA (pull, mai push), esattamente come oggi il Composer legge `context.travelerDNA` con un default neutro per un utente nuovo — zero accoppiamento, zero regressione. Un AI Concierge che risponde genericamente senza questo fondamento non è una versione anticipata del prodotto finale: è un prodotto diverso che tradisce il motivo per cui Travel OS ha investito nell'Event Bus, nella sua purezza, e nel Traveler DNA fin dall'inizio. Vedi [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) per l'ordine architetturale che rende questo vincolante, non opzionale.

## Filosofia della Travel Memory

Esistono, e resteranno, due forme di memoria distinte:

- **Memoria dichiarata** (`PlaceMemories`) — quello che l'utente sceglie di scrivere: un diario, un voto, una foto. Appartiene al singolo luogo, nel singolo viaggio. È sempre esplicita, sempre sotto il controllo diretto dell'utente.
- **Memoria osservata** (Traveler DNA) — quello che l'utente effettivamente fa, dedotto dal comportamento nel tempo: quanto resta in un museo rispetto al previsto, a che ora preferisce cenare, quanti chilometri a piedi tollera prima di saltare una tappa. Cross-trip, user-level, derivata solo da fatti — mai scritta direttamente, mai un setter pubblico.

Le due si alimentano a vicenda (un voto a 5 stelle nel diario è anche un segnale per il DNA) ma **non si fondono mai in un unico modello** — la stessa disciplina che il `PlaceMergeEngine` applica ai tre livelli di un luogo, applicata alla memoria del viaggiatore stesso. Il giorno in cui qualcuno propone di "semplificare" unendo diario e profilo comportamentale in un solo oggetto, quella proposta sta proponendo di perdere per sempre la distinzione tra "quello che dico di essere" e "quello che sono quando nessuno mi guarda" — che è, in fondo, il punto di avere un Traveler DNA.

La memoria osservata è inoltre, per requisito di design non negoziabile fin dal primo rigo scritto (non aggiunto dopo): consenso esplicito prima dell'attivazione, diritto alla cancellazione totale, portabilità dei dati. Non è un dettaglio di compliance da aggiungere quando arriva un requisito legale — è parte della definizione stessa di cosa significa raccogliere responsabilmente il comportamento di una persona.

## Come usare questo documento

Non sostituisce le [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md) (più operative, ancorate a codice specifico) né la [DESIGN_PHILOSOPHY.md](../vision/DESIGN_PHILOSOPHY.md) (più concreta su come si "sente" una giornata). Questo documento è il livello sopra entrambi: quando una decisione tecnica è ambigua o quando una nuova feature sembra ragionevole ma "stona", la domanda da fare non è "è tecnicamente fattibile?" ma "è ancora Travel OS, o è diventato un trip planner qualsiasi?".
