# ADR-016: Journey Score — NaN Edge Case (Technical Note)

**Stato**: Documentato — correzione proposta, **non implementata**
**Data**: Luglio 2026
**Autori**: Rocco (owner) + Claude (estrazione e analisi)
**Riferimenti**: [JourneyScoreCalculator.ts](../../src/domain/services/JourneyScoreCalculator.ts), [JourneyScoreCalculator.test.ts](../../src/domain/services/JourneyScoreCalculator.test.ts)

---

## 1. Contesto

Durante l'estrazione del Journey Score da `ContextEngine.recompose()` in un Domain Service puro (`JourneyScoreCalculator`), è stato individuato — non introdotto — un caso limite preesistente nella logica di calcolo. Il refactoring era vincolato a **nessuna modifica di comportamento**: il bug è stato quindi preservato fedelmente e bloccato da un test dedicato (`JourneyScoreCalculator.test.ts`, describe `"preexisting edge case (documented, not fixed)"`), non corretto silenziosamente.

Questa nota documenta il bug e propone una correzione, da valutare e implementare separatamente.

---

## 2. Il bug

**Trigger**: `savedPlacesCount > 0` **e** `days.length === 0` — cioè: l'utente ha salvato almeno un luogo, ma la timeline del viaggio non ha ancora nessun giorno generato.

**Meccanismo esatto** (in `JourneyScoreCalculator.calculate`, originariamente inline in `ContextEngine.recompose`):

```ts
const daysWithPlaces = days.filter((d) => d.totalPlacesCount > 0).length; // 0
const daysRatio = Math.min(daysWithPlaces / days.length, 1);              // 0 / 0 = NaN
balanceScore += Math.round(daysRatio * 20);                                // NaN
```

`NaN` si propaga per contagio attraverso tutta la somma finale:

```ts
const totalScore = planningScore + balanceScore + foodScore + walkingScore + conflictScore; // NaN
const score = Math.min(totalScore, 100); // NaN
```

Risultato: `score: NaN`, `statusLabel: "Pronto al NaN%"`.

**Effetto collaterale in `ContextEngine`**: `composed.journeyQualityLabel` viene calcolato con un confronto a soglie sul punteggio (`if (composed.journeyScore >= 90) ...`). Qualunque confronto con `NaN` è sempre `false`, quindi il codice cade sempre nell'ultimo `else`, mostrando **`'★☆☆☆☆ Inizia a pianificare'`** — indipendentemente da quanto l'utente abbia effettivamente pianificato. Due sintomi visibili quindi, non uno: l'etichetta percentuale mostra `NaN%` *e* la valutazione a stelle mostra sempre la più bassa.

**Quando è raggiungibile in pratica**: `PlacesEngine` e `TimelineEngine` sono sottosistemi indipendenti con hydration separata (`PlacesEngine.savedPlacesMap` e `TimelineEngine.timelineMap` sono popolati da chiamate distinte — `getSavedPlaces` vs `getTripTimeline`). È quindi plausibile che un luogo venga salvato in libreria prima che `getTripTimeline` sia mai stato invocato per quel trip, lasciando `timeline.days` a `[]` mentre `savedPlaces.length > 0` — esattamente la condizione di innesco. Non è un caso puramente teorico.

**Impatto prodotto**: non è un crash — l'aritmetica JS con `NaN` non lancia eccezioni — ma è un momento potenzialmente di "prima impressione": proprio quando un utente inizia a salvare i primi luoghi di un viaggio, prima ancora di toccare l'itinerario, vede un punteggio `NaN%` e la valutazione più bassa possibile. `trip.store.ts` inoltre persiste questo valore (`progress: context.journeyScore`) nello storage del trip.

---

## 3. Correzione proposta (non implementata)

Tre opzioni, in ordine di preferenza:

### Opzione A — Guardia locale sulla divisione (consigliata)
```ts
const daysRatio = days.length > 0 ? Math.min(daysWithPlaces / days.length, 1) : 0;
```
Trattare "zero giorni generati" come "zero giorni organizzati" (`daysRatio = 0`), non come indeterminato. Il resto del calcolo (planning, conflitti, pasti, camminata) continuerebbe a riflettere il segnale reale già presente (es. `planningScore` base a 20 per aver salvato luoghi). Con questa guardia, lo scenario del test attuale produrrebbe uno score di **50** invece di `NaN` (dai valori già verificati nel test: planning 20 + balance 0 + conflict 10 + food 20 + walking 0).

**Perché è la scelta preferita**: rispecchia meglio la semantica reale — "hai salvato dei luoghi ma non hai ancora organizzato la timeline" è uno stato di progresso parziale legittimo, non un errore.

### Opzione B — Guardia a monte sull'intero blocco
```ts
if (savedPlacesCount > 0 && days.length > 0) { ... }
```
Più aggressiva: se non ci sono giorni, l'intero punteggio resta a 0, ignorando anche il segnale "ho salvato luoghi". Più semplice, ma perde informazione che l'Opzione A conserva.

### Opzione C — Fix a monte, non nel calcolo del punteggio
Il problema potrebbe essere sintomo di un problema di hydration più a monte: se `TimelineEngine` garantisse sempre almeno un giorno generato appena un trip esiste (invece di restituire `[]` finché `getTripTimeline` non viene invocato esplicitamente), il caso `days.length === 0` con `savedPlacesCount > 0` non si presenterebbe mai, rendendo la guardia difensiva superflua. Questo è imparentato con la race di hydration già osservata e corretta in [ADR-015](./015-domain-events-purity.md) (`TimelineEngine` e `PlacesEngine` si idratano in modo indipendente e non sincronizzato) — vale la pena valutarli insieme piuttosto che patchare solo il sintomo nel calcolo del punteggio.

---

## 4. Cosa aggiornare quando si implementa la correzione

Il test `JourneyScoreCalculator.test.ts` → describe `"preexisting edge case (documented, not fixed)"` asserisce esplicitamente il comportamento attuale (`Number.isNaN(result.score) === true`). Quando la correzione verrà implementata, **questo test va aggiornato per asserire il nuovo comportamento atteso** (es. `score === 0` per l'Opzione B, o il valore calcolato per l'Opzione A) — non va semplicemente rimosso, per mantenere il test come documentazione vivente della decisione presa.

---

## 5. Decisione

Nessuna, per ora. Questa nota documenta il bug e le opzioni; l'implementazione resta una decisione separata ed esplicita, coerente con lo scope del refactoring puro che l'ha portato alla luce.
