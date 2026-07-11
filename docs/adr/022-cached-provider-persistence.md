# ADR-022: CachedProvider — Persistenza MMKV, TTL configurabile, Eviction LRU

**Stato**: Implementata
**Data**: Luglio 2026
**Autori**: Rocco (owner) + Claude (analisi, design, implementazione)
**Riferimenti**: [ADR-021](021-engine-repository-abstraction.md) (Repository Abstraction, stesso pattern applicato qui), [CachedProvider.ts](../../src/domain/providers/CachedProvider.ts), [TravelServices.ts](../../src/domain/providers/TravelServices.ts)

---

## 1. Contesto

Review architetturale (Task 3 — Architecture Hardening): `CachedProvider<T>`, il layer di cache generico usato da tutti i servizi del SIP (Weather, Routing, OpeningHours, Places, Currency, Translation), teneva l'intera cache in una `Map` in-memory — persa a ogni riavvio dell'app. Per un'app dichiaratamente Offline-First, questo significa che al riavvio (o dopo che l'app viene terminata dal sistema in background) ogni singola chiamata a un servizio esterno riparte da zero, anche per dati con TTL di giorni (Places, Routing: 7 giorni; Translation: 30 giorni) che sarebbero ancora validi.

**Verificato prima di agire**: `CachedProvider` ha un solo punto di istanziazione in tutto il repository (`TravelServices.ts`, 6 istanze — una per servizio) — stessa situazione di ADR-021 per gli Engine, nessun'altra retrocompatibilità da preservare oltre quel file.

## 2. Decisione

### 2.1 Stessa disciplina Repository di ADR-021

`ICacheRepository<T>` (nuovo, `src/domain/providers/cache-repository.interface.ts`) + `MMKVCacheRepository<T>` (implementazione, un'istanza per namespace — 'Weather', 'Routing', ecc. — stesso "un repository per aggregato" già stabilito). `CachedProvider` dipende solo dall'interfaccia: non conosce MMKV, chiavi di storage né formato di cache, coerente con la disciplina appena introdotta per gli Engine di dominio.

### 2.2 Trasparenza — zero cambi di firma, zero cambi ai call site di Weather/Places/Routing/Currency

Il costruttore guadagna un terzo parametro **opzionale** (`options?: { repository?, maxEntries? }`) — omesso, il comportamento è identico a prima (solo RAM). Tutti i metodi pubblici (`get`, `set`, `hasValid`, `getPeek`, `invalidate`, `size`) mantengono **esattamente** la stessa firma:
- `get()` (già `async`) attende internamente l'idratazione prima di consultare la cache — trasparente, nessun chiamante deve saperlo.
- `set()` **resta sincrono**: scrive subito in RAM (comportamento invariato) e lancia la persistenza su storage in background (fire-and-forget, stesso idioma già in uso altrove nel codebase per scritture non bloccanti — es. `TripLifecycleWatcher`). Un crash dell'app nella minuscola finestra tra `set()` e la risoluzione della scrittura asincrona perderebbe quella singola entry — accettabile per dati sempre ri-derivabili dalla rete.
- `hasValid()`/`getPeek()`/`size()` **restano sincroni** (nessun `Promise` introdotto, non consentito da "no API changes"): durante la brevissima finestra tra avvio app e fine idratazione, potrebbero non vedere ancora una entry persistita valida. Verificato che nessun chiamante nel codebase usa oggi `getPeek`/`hasValid` (grep a tappeto, zero occorrenze) — impatto pratico nullo, comunque documentato come limite noto.

Nessuno dei 6 call site in `TravelServices.ts` (Weather/Routing/OpeningHours/Places/Currency/Translation) ha richiesto modifiche oltre all'aggiunta delle opzioni di persistenza nella riga di costruzione — la logica dei rispettivi metodi (`.weather()`, `.places()`, `.routing()`, `.currency()`, ecc.) è invariata byte per byte.

### 2.3 TTL configurabile — invariato, ora sopravvive al riavvio

Il TTL era già configurabile (per-istanza `defaultTtlMs`, per-chiamata `customTtlMs`) — nessuna modifica a questo meccanismo. La novità è che `ttlMs`/`timestamp` vengono persistiti insieme al dato: dopo un riavvio, il confronto `now - cached.timestamp < cached.ttlMs` usa lo stesso timestamp reale di scrittura, quindi un'entry scaduta durante l'assenza dell'app viene correttamente trattata come scaduta (re-fetch), non come sempre-valida.

### 2.4 Eviction LRU — nuova, per-namespace

`maxEntries` (default 200, configurabile per istanza — 300 per Places, 100 per Currency, 500 per Translation, scelti in base al volume tipico di chiavi distinte di ciascun servizio). L'ordine di iterazione della `Map` in-memory *è* l'ordine LRU: ogni scrittura o hit di lettura sposta la entry in coda (`touch()`, delete+re-insert); quando `size() > maxEntries`, la entry in testa (meno recentemente usata) viene evitta sia dalla RAM sia — se configurato un repository — dallo storage persistente.

**Semplificazione deliberata**: l'indice persistito (`MMKVCacheRepository`) riflette l'ordine di **scrittura**, non di ogni singola **lettura** — un hit di cache aggiorna la recency solo in-memory. Persistere la recency a ogni lettura moltiplicherebbe gli I/O su storage per un guadagno marginale (i dati "caldi" vengono comunque riscritti periodicamente alla scadenza del TTL, mantenendo aggiornata la loro posizione nell'indice su disco). Se in futuro servisse una vera LRU-by-access-time persistita, va rivalutato come decisione separata.

### 2.5 Migrazione — nessuna migrazione in-place, versionamento per chiave

Non esiste alcun dato pregresso da migrare: la cache era RAM-only, quindi lo storage persistente parte vuoto al primo avvio con questa versione. La domanda rilevante per il futuro è: cosa succede quando la **forma** di `CacheEntry<T>` cambierà in modo incompatibile?

**Decisione**: `MMKVCacheRepository` incorpora una costante `CACHE_SCHEMA_VERSION` nel prefisso di ogni chiave (`cache_v{N}_entry_{namespace}_{key}`, `cache_v{N}_index_{namespace}`). Bump della costante = le entry della versione precedente diventano semplicemente invisibili (mai lette, mai causa di crash o di dato malformato) — non serve alcun codice di migrazione in-place. Questa scelta è deliberata e specifica alla natura di questi dati: **sono sempre cache di dati derivati e ri-fetchabili** (meteo, rotte, luoghi, tassi di cambio) — a differenza di `Trip`/`TripSetup` (dati utente reali, dove ADR-021 preserva le chiavi esistenti per non perdere nulla), qui non c'è nulla da "salvare": la degradazione sicura è ignorare silenziosamente il vecchio formato e ripartire da una cache vuota sotto la nuova versione, riempita naturalmente dal primo giro di fetch reali.

Le chiavi vecchie non vengono attivamente ripulite (nessuna cancellazione di massa): `ILocalDatabase` non espone un'enumerazione delle chiavi per prefisso (stesso limite già noto da ADR-021, non esteso qui per non allargarne il raggio d'azione) — restano come storage morto di dimensione limitata (bound dallo stesso `maxEntries` che le aveva scritte), accettabile per una cache disponibile.

### 2.6 Difetto preesistente scoperto e corretto: `AsyncStorage` non protetto in `mmkv.adapter.ts`

Durante la verifica ("keep tests green"), collegare `TravelServices.ts` a `MMKVAdapter` ha fatto emergere per la prima volta un bug latente preesistente: `mmkv.adapter.ts` importava `AsyncStorage` con un `import` statico **non protetto** — solo l'inizializzazione di MMKV nativo era in un `try/catch` graceful, non l'import di `AsyncStorage`. In un ambiente senza il modulo nativo `RNCAsyncStorage` linkato (es. Jest puro, senza un preset React Native), il solo *importare* questo file **crashava**, non solo l'uso di AsyncStorage in sé. Prima di questa sessione nessun test toccava mai transitivamente `MMKVAdapter` — collegare `CachedProvider` a MMKV lo ha reso raggiungibile da `JourneyComposer.test.ts`/`timeline.engine.test.ts`/`context.engine.test.ts` (tutti importano `TravelServices` transitivamente per il meteo/i luoghi), rompendo 3 suite.

**Corretto**: `AsyncStorage` ora viene richiesto pigramente e in modo protetto (stesso pattern già in uso per MMKV), con un ultimo fallback volatile in-memory se **né** MMKV **né** AsyncStorage sono disponibili — garantisce che importare `mmkv.adapter.ts` non crashi mai, in nessun ambiente JS. Non è un fix "fuori scope": è la causa radice che bloccava il requisito esplicito "keep tests green" di questo task.

## 3. Conseguenze

**Positive**: Weather/Places/Routing/Currency (e OpeningHours/Translation) sopravvivono ora al riavvio dell'app senza alcuna modifica ai propri call site — verificato con test dedicati che simulano esplicitamente un "riavvio" (repository popolato prima della costruzione di una nuova istanza di `CachedProvider`). `mmkv.adapter.ts` è ora sicuro da importare in qualunque ambiente JS, non solo React Native — corregge un rischio di crash pre-esistente, non solo un problema di test.

**Non toccato, deliberatamente**:
- `ILocalDatabase` non è stato esteso con un'enumerazione delle chiavi — necessaria per un'eventuale pulizia attiva delle entry di schema-version obsolete, ma allargherebbe il contratto condiviso con Trip/Places/Timeline (ADR-021) oltre lo scope di questo task.
- Nessuna vera LRU-by-access-time persistita (solo per-scrittura) — vedi §2.4.
- I 6 valori di `maxEntries` sono stime ragionevoli, non misurate su traffico reale — da rivedere se telemetria futura mostra pattern diversi.

## 4. Verificato

`tsc --noEmit`: 0 errori. `jest`: 201 → 223/223 (22 suite, +22 test nuovi: `CachedProvider.test.ts` — comportamento RAM-only invariato, persistenza trasparente, TTL attraverso un "riavvio" simulato, eviction LRU sia in-memory sia persistita; `mmkv-cache.repository.test.ts` — round-trip, ordine LRU, isolamento tra namespace). Nessun test preesistente modificato; le 3 suite rotte dal difetto di `mmkv.adapter.ts` sono state corrette, non aggirate.

## 5. Addendum (Architecture Verification Pass — Luglio 2026): race condition sull'indice LRU chiusa

Una pass di verifica architetturale su ADR-020/021/022 ha trovato che `MMKVCacheRepository.set()`/`delete()`/`clear()` facevano un read-modify-write in due round-trip separati (`getIndex()` poi `setIndex()`) sull'indice LRU condiviso del namespace — non atomico. `CachedProvider.set()` lancia questa persistenza fire-and-forget e non serializzata: due scritture concorrenti per **chiavi diverse** nello stesso namespace (scenario realistico — es. `getCurrentWeather`/`getDailyForecast` per la stessa località richiesti quasi in contemporanea, entrambi nella cache `Weather`) potevano entrambe leggere l'indice prima che l'altra scrivesse, e l'ultima a scrivere azzerava silenziosamente l'aggiunta dell'altra — l'entry restava scritta nel proprio slot di storage ma diventava invisibile a `getAllEntries()` (quindi anche alla prossima idratazione da riavvio) finché qualcos'altro non riscriveva quella stessa chiave.

**Corretto**: `MMKVCacheRepository` ora serializza le proprie mutazioni dell'indice tramite una coda in-process (`enqueueMutation`, una Promise-chain interna all'istanza) — ogni `set`/`delete`/`clear` per lo stesso namespace attende che la mutazione precedente sia conclusa prima del proprio read-modify-write. Poiché ogni istanza di questa classe corrisponde a un solo namespace (stesso principio "un repository per aggregato" di ADR-021), una coda in-process è sufficiente: non serve un lock distribuito. Preserva invariati l'interfaccia (`ICacheRepository<T>`), la semantica LRU (l'ordine resta quello di scrittura) e la trasparenza della persistenza per `CachedProvider` (nessun cambio ai suoi call site).

Regressione bloccata da 3 nuovi test in `mmkv-cache.repository.test.ts` (scritture concorrenti per chiavi diverse, set+delete concorrenti, 20 scritture concorrenti) — verificati fallire senza la correzione: la prova più netta ne perdeva 19 su 20.

**Verificato**: `tsc --noEmit` 0 → 0 errori; `jest` 223 → 230/230 (+3 test di regressione per questo difetto).
