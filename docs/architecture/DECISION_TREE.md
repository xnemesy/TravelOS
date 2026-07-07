# DECISION_TREE.md

> Dove va il codice che sto per scrivere? Albero decisionale rapido — se la risposta non è ovvia dopo questo, leggi [ARCHITECTURE.md](ARCHITECTURE.md) prima di procedere. Non sostituisce [KNOWN_DEBT.md](../context/KNOWN_DEBT.md): verifica sempre di non estendere un percorso morto (vedi [ENGINE_MAP.md](ENGINE_MAP.md)).

```
Sto costruendo UI (componente, schermata)?
├─ È generico/riusabile tra feature diverse?
│    → src/shared/components/
├─ È specifico di una feature verticale?
│    → src/features/<feature>/components/
└─ Deve leggere/scrivere stato di dominio?
     → SOLO tramite src/shared/hooks/
       (useTravelContext, usePlaces, useTimeline, useNextPlace, useTravelActions)
       MAI import diretto di Engine/Store/Repository nel componente.

Sto scrivendo un calcolo puro (nessun I/O, nessuno stato)?
    → src/domain/services/
      (stateless, no Date.now()/Math.random(), test co-locato senza mock)
    → Se è una regola di valutazione di un candidato durante la pianificazione:
      → src/domain/services/rules/ (implementa ITimelineRule, registra il peso
        in timeline-rule-weights.ts, inseriscila nell'ordine in TimelineRuleEngine)

Sto orchestrando stato con side-effect (persistenza, pubblicazione eventi)?
    → src/core/engines/ (un Engine: ContextEngine/PlacesEngine/TimelineEngine
      o un futuro motore Fase 2/3 — verifica prima in ENGINE_MAP.md se esiste
      già un contratto IXxxEngine da implementare)

Sto notificando che qualcosa È GIÀ SUCCESSO (fatto di dominio)?
├─ Il consumer è in un modulo diverso da chi pubblica?
│    → eventBus.publish(DomainFact) — nome in tempo passato, mai un comando
└─ Il consumer è nello stesso modulo (es. "ho aggiornato la mia cache")?
     → chiamata diretta a contextEngine.recompose() — NON l'Event Bus
       (vedi EVENT_BUS.md, regola d'oro)

Sto parlando con un provider esterno (luoghi, meteo, orari, routing, valuta)?
    → src/domain/providers/TravelServices.ts (SIP)
      MAI una chiamata fetch/axios diretta da un Engine o da un componente UI.
      Se serve nascondere una API key → valuta backend/ (proxy Fastify), non il client.

Sto persistendo dati localmente?
    → ILocalDatabase (src/core/storage/) — oggi solo MMKVAdapter
      MAI Firebase Firestore/Storage per dati di viaggio (inizializzati ma non
      collegati — vedi KNOWN_DEBT.md): la sincronizzazione cloud non esiste ancora.

Sto validando/modellando un'entità di dominio?
├─ È un aggregato persistito con regole di validazione utente (Trip, Place)?
│    → schema Zod in src/domain/<aggregato>/models/
└─ È una forma interna di supporto alla pianificazione (PlaceRef, JourneyPlace)?
     → interfaccia plain-TS in src/core/engines/types/ o models/
       (verifica in DOMAIN_MODEL.md quale delle rappresentazioni parallele
       è quella corretta per il confine che stai toccando)
```

## Domande di controllo prima di committare

1. Ho importato un hook di `src/shared/hooks/` invece di un Engine/Store/Repository nel componente UI? → [ARCHITECTURE.md](ARCHITECTURE.md)
2. Se ho toccato l'Event Bus, ogni evento pubblicato è un fatto realmente accaduto, non un trigger tecnico? → [EVENT_BUS.md](EVENT_BUS.md)
3. Se ho aggiunto calcolo puro, ho verificato che non dipenda da `Date.now()`/`Math.random()` e ho aggiunto un test co-locato? → [TESTING_STRATEGY.md](TESTING_STRATEGY.md)
4. Sto estendendo il percorso di pianificazione attivo (`PlaceRef`/`TimelineEngine`) e non quello legacy (`TravelPlace`/`PlannerEngine`)? → [ENGINE_MAP.md](ENGINE_MAP.md)
