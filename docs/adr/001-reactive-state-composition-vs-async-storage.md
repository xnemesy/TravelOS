# ADR-001: Composizione Reattiva dello Stato e Roadmap verso il Provider Layer

**Stato**: Accettato / Validato tramite Vertical Slice (Fase 1)  
**Data**: Luglio 2026  
**Autori**: Team Architettura Travel OS  

---

## 1. Contesto e Problema
Durante la **Fase 1** di Travel OS, abbiamo introdotto il `ContextEngine` come centro nevralgico della business logic per superare la frammentazione degli store di UI (Zustand/MMKV/Firebase). L'obiettivo della verifica finale (Vertical Slice) era dimostrare la fattibilità di un intero ciclo di viaggio:
$$\text{Ricerca} \longrightarrow \text{Salvataggio} \longrightarrow \text{Pianificazione} \longrightarrow \text{Journey} \longrightarrow \text{Check-in} \longrightarrow \text{Memories}$$
senza che l'interfaccia utente leggesse mai direttamente store di dati o repository esterni.

Durante l'implementazione del Vertical Slice, è emerso il bisogno di garantire transizioni istantanee (60fps) e reattività immediata alla UI (es. quando un utente esegue il "Check-in" di una tappa in tempo reale o assegna un luogo a una giornata del planner), evitando spinner di caricamento o blocchi del thread di rendering dovuti a scritture I/O asincrone su disco (Isar/SQLite/MMKV).

---

## 2. Decisione Architetturale (Fase 1 Congelata)
Abbiamo deciso e validato che:
1. **Composizione Sincrona In-Memory**: Il `ContextEngine` ricompone lo stato (`TravelContext`) in memoria in modo interamente sincrono non appena intercetta eventi di dominio (`PlaceSaved`, `PlaceVisited`, `TimelineReordered`, ecc.) sull'`eventBus`.
2. **Disaccoppiamento della Persistenza**: La persistenza asincrona su disco (tramite repository o database cifrato Isar) è relegata ai singoli motori di dominio (`PlacesEngine`, `TimelineEngine`), che operano in background o tramite isolate Dart/JS senza mai bloccare la notifica reattiva al View Layer.
3. **Regola d'Oro del View Layer**: Gli Hook di accesso al View Layer (`useTravelContext`, `usePlaces`, `useTimeline`, `useNextPlace`, `useTravelActions`) sono l'unica barriera di contatto tra i componenti React/React Native e il dominio. È rigorosamente vietato importare store, repository o provider direttamente nei componenti UI.

---

## 3. Conseguenze e Trade-off
- **Vantaggi (Pro)**:
  - **Reattività Ottimale**: L'interfaccia si aggiorna in meno di 16ms a ogni comando di dominio.
  - **Testabilità Assoluta**: Il flusso verticale può essere testato end-to-end iniettando eventi sull'`eventBus` o chiamando i metodi puri degli Engine senza dipendere da storage reali.
  - **Modularità**: Nessuna schermata UI conosce la struttura interna di persistenza.
- **Svantaggi (Con)**:
  - Necessità di mantenere sincronizzato lo snapshot in memoria al boot dell'applicazione tramite un processo di *pre-seeding* o idratazione iniziale dai repository.

---

## 4. Evoluzione Strategica: Roadmap al Provider Layer (Pre-Fase 2)
Al termine del Vertical Slice e prima di avviare lo sviluppo dei motori della Fase 2 (`JourneyEngine`, `BudgetEngine`, `MemoriesEngine`), l'architettura evolverà introducendo un **Provider Layer** interamente disaccoppiato dagli Engine.

```
       [ VIEW LAYER ] (Hook Granulari: usePlaces, useTimeline, ecc.)
             │
             ▼
    [ CONTEXT ENGINE ] (Compositore Reattivo Sincrono)
             ▲
             │ (Domain Events)
   ┌─────────┴─────────┐
   │  DOMAIN ENGINES   │ (PlacesEngine, TimelineEngine, ecc.)
   └─────────┬─────────┘
             │ (Dipendenza da Interfacce Astratte)
             ▼
   ┌────────────────────────────────────────────────────────┐
   │                   PROVIDER LAYER                       │
   │  IPlacesProvider   IWeatherProvider   IBookingProvider │
   │  IPhotosProvider   ICalendarProvider                   │
   └────────────────────────────────────────────────────────┘
             │
             ▼
 [ CONCRETE IMPLEMENTATIONS ] (Google, Apple, OSM, Booking, Skyscanner)
```

### Regole del Futuro Provider Layer:
1. **Indipendenza Assoluta**: Gli Engine dipenderanno esclusivamente da interfacce astratte (es. `IPlacesProvider.searchPlaces()`, `IWeatherProvider.getForecast()`).
2. **Intercambiabilità**: Qualsiasi servizio esterno (Google Places, Apple Maps, OpenStreetMap, Booking.com, Skyscanner, OpenWeather) potrà essere sostituito o integrato senza modificare una sola riga della logica di dominio o del `ContextEngine`.
3. **Da Applicazione a Piattaforma**: Questo passaggio trasformerà definitivamente Travel OS da semplice applicazione di viaggio a una **piattaforma di viaggio estendibile**, pronta per integrare futuri moduli, API di terze parti e servizi Zero-Knowledge per la privacy.
