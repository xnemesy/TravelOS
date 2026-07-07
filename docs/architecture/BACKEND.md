# BACKEND.md

> `backend/` è un servizio separato, non parte del nucleo reattivo descritto in [ARCHITECTURE.md](ARCHITECTURE.md). Deploy indipendente, ciclo di vita indipendente.

## Cos'è, in una frase

Un proxy Fastify/TypeScript **stateless** davanti alla Google Places API (New) — nasconde la API key, normalizza la risposta in un modello `Place` proprio di Travel OS, e fa da proxy anche per le foto (così il client non ha mai bisogno di una chiave Google). Non è un backend applicativo generico: nessun database, nessuna autenticazione, nessuna logica di prenotazione.

## Endpoint

| Metodo | Path | Funzione |
|---|---|---|
| GET | `/health` | Liveness check |
| GET | `/version` | Versione + revision Cloud Run |
| GET | `/ready` | Readiness — verifica la API key e fa una chiamata di test reale a Google |
| GET | `/docs` | Swagger UI (auto-generata) |
| GET | `/api/places/search` | Ricerca testuale/geografica → Google Places `searchText` |
| GET | `/api/places/autocomplete` | Suggerimenti → Google Places `autocomplete` |
| GET | `/api/places/:id/details` | Dettaglio luogo per ID provider |
| GET | `/api/places/photo/*` | Proxy foto — stream JPEG, cache 30 giorni |

Tutte le route (eccetto `photo`) passano da `PlacesService`, un pass-through verso qualunque `PlacesProvider` sia iniettato — oggi hardcoded su `GooglePlacesProvider`.

## Integrazione con Google Places

`GooglePlacesProvider` ([GooglePlacesProvider.ts](../../backend/src/providers/google/GooglePlacesProvider.ts)) è l'unico provider esterno reale nel backend: chiama `https://places.googleapis.com/v1` con autenticazione header (`X-Goog-Api-Key`), protetto da un circuit breaker (3 fallimenti → 10s di cooldown) e un retry singolo con backoff su errori di rete/5xx/timeout. Mappa la risposta Google nel modello `Place` interno, inclusa una stima euristica della durata di visita per tipo di luogo (museo 120min, chiesa 30min, ristorante 75min...), e riscrive i riferimenti foto in URL proxati (`/api/places/photo/{encoded}`).

## Stato — senza persistenza, senza auth

- **Nessun database**: `server.ts` dichiara esplicitamente `database: 'stateless'` sull'endpoint `/ready`. Esiste un `CacheRepository` (cache TTL in-memory) ma **non è collegato** a `PlacesService` — scaffolding non attivo.
- **Nessuna autenticazione**: nessun middleware auth/JWT/API-key lato client. L'unica protezione è il rate limiting globale (100 richieste/minuto).
- **Validazione**: Zod valida le variabili d'ambiente e il modello `Place`, ma **non** i parametri di query in ingresso (parsing manuale, non schema-validato).

## Come si collega all'app mobile — confermato attivo, non solo teorico

L'app Expo chiama questo backend tramite `TravelBackendService` → `TravelBackendRepository`, selezionato in `TravelServices.ts` quando `EXPO_PUBLIC_USE_REAL_PLACES === 'true'` (vedi [DATA_FLOW.md](DATA_FLOW.md)). La configurazione attuale (`.env`, non `.env.example`) punta a un'istanza Cloud Run già deployata (`europe-west8`, Milano) con quel flag attivo — cioè **la ricerca luoghi reale è la modalità di default in esecuzione oggi**, non un'opzione sperimentale. Se il backend non risponde, `TravelServices` degrada al catalogo mock (vedi [PRODUCT_PRINCIPLES.md](../vision/PRODUCT_PRINCIPLES.md#1-meglio-un-compromesso-onesto-che-un-errore-silenzioso)).

## Deploy

Docker multi-stage (Node 20 Alpine) → Google Cloud Run. `PORT=8080` di default, `K_REVISION` (env Cloud Run) esposta su `/version`. Config validata a boot con Zod (`PORT`, `NODE_ENV`, `GOOGLE_PLACES_API_KEY` obbligatoria — il processo esce con errore se manca). Il backend legge il proprio `.env` da `backend/.env`, separato dal `.env` dell'app mobile alla radice del repo.

## Cosa manca, deliberatamente, oggi

Nessun provider meteo/routing/valuta/traduzione lato backend — quelli sono gestiti interamente lato client come mock (vedi [DATA_FLOW.md](DATA_FLOW.md)). Non aggiungere provider al backend senza un motivo esplicito per farlo lato server invece che lato client (tipicamente: nascondere una API key, come già avviene per Google Places).
