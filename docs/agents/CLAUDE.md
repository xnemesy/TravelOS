# CLAUDE.md — Note per Claude su Travel OS

> Le regole operative sono in [`AGENTS.md`](AGENTS.md) — questo file le eredita per intero e aggiunge solo ciò che è specifico di Claude/Claude Code.

## Priorità di lettura

Il repo ha già un `/CLAUDE.md` alla radice che importa `/AGENTS.md` (nota Expo v56) — quello si applica automaticamente ad ogni sessione. Questa Knowledge Base (`/docs`) non è auto-caricata: se stai leggendo questo file, molto probabilmente sei già stato indirizzato qui esplicitamente, oppure dovresti indirizzarti qui da solo prima di qualunque modifica non banale — parti da [`/docs/context/PROJECT_STATE.md`](../context/PROJECT_STATE.md) e [`/docs/agents/AGENTS.md`](AGENTS.md).

## Cosa vale la pena fare con gli strumenti di ricerca

Il codebase ha percorsi paralleli vivi/morti (vedi [AGENTS.md](AGENTS.md#percorsi-paralleli--verifica-sempre-quale-stai-toccando)) — prima di modificare un file in `src/domain/trip/engine/` o `src/features/places/store/`, verifica con una ricerca chi lo importa realmente, non assumere dalla posizione nel filesystem. Un Task/subagent di esplorazione è appropriato per questo tipo di verifica quando il grep manuale non basta.

## Test

`npm test` esegue l'intera (piccola) suite Jest — 4 file, 40 test, tutti su Domain Service puri sotto `src/domain/`. Non aspettarti copertura su Engine, hook o componenti: se il tuo cambiamento tocca logica pura in `src/domain/services/` o `src/domain/trip/engine/`, aggiungi un test co-locato nello stesso stile esistente (vedi [TESTING_STRATEGY.md](../architecture/TESTING_STRATEGY.md)) prima di considerare il lavoro concluso.

## Prima di aprire una PR o proporre un refactoring ampio

Controlla [`KNOWN_DEBT.md`](../context/KNOWN_DEBT.md): molte cose che sembrano "da pulire" a prima vista (due `PlaceRepository`, componenti orfani in `trip-experience/`, `IMemoriesEngine` con naming ambiguo) sono già note e tracciate, spesso con una ragione esplicita per cui non sono ancora state rimosse. Non proporre una rimozione di massa senza aver letto quel documento — potrebbe già spiegare perché è rimandata o cosa la blocca.
