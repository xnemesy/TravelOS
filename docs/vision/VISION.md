# VISION.md — Travel OS

> Documento di vertice. Ogni altro documento in `/docs` esiste per rendere questa visione eseguibile senza perdita di significato tra una sessione e l'altra, tra un agente AI e l'altro.

## Cos'è Travel OS

Travel OS non è un'app per prenotare voli né una checklist di cose da vedere. È un **motore di composizione di viaggi**: prende luoghi (salvati, editoriali, scoperti) e li trasforma in giornate vivibili — con orari realistici, pause, pasti, distanze a piedi sostenibili — tenendo conto di vincoli reali (orari di apertura, meteo, energia del viaggiatore, stile di viaggio).

Il nome "OS" non è marketing: l'app è pensata come un sistema operativo per il viaggio, con un nucleo di dominio (motori, regole, servizi puri) che orchestra dati esterni e li espone a una UI reattiva, esattamente come un OS espone servizi alle applicazioni. Vedi [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) per la mappa tecnica di questo nucleo.

## Il problema che risolve

Pianificare un viaggio con le app esistenti significa scegliere tra due estremi:
1. **Liste statiche** (Google Maps stellati, board Pinterest, fogli Excel) — richiedono che sia l'utente a fare mentalmente tutto il lavoro di sequenziamento, stima tempi, verifica orari.
2. **Tour pacchettizzati** — tolgono ogni margine di personalizzazione, trattano il viaggiatore come passeggero di un itinerario fisso.

Travel OS si posiziona nel mezzo: l'utente sceglie *cosa* vuole vedere (Libreria), il motore di dominio decide *come* e *quando* — rispettando vincoli reali — lasciando sempre il controllo finale (drag&drop, pin, override) nelle mani dell'utente. Il principio guida è espresso letteralmente nel codice del `JourneyComposer`: **"Non inventa mai luoghi esterni: lavora esclusivamente sui luoghi resi disponibili"** — il motore compone, non sostituisce, la volontà del viaggiatore.

## Il ciclo che Travel OS vuole chiudere

```
Ricerca → Salvataggio → Pianificazione → Journey → Check-in → Memories
```

Oggi (Fase 1) il ciclo è implementato dalla ricerca al check-in in tempo reale: vedi [PROJECT_STATE.md](../context/PROJECT_STATE.md) per cosa è realmente costruito rispetto a cosa è ancora disegno. Il ramo di ritorno — trasformare l'esperienza vissuta in intelligenza che migliora il viaggio successivo (**Traveler DNA**, ADR-014) — è il pezzo mancante che definisce la direzione strategica del prodotto, non solo una feature tra le altre. Vedi [DIFFERENTIATORS.md](DIFFERENTIATORS.md) e [TRAVEL_OS_DNA.md](../context/TRAVEL_OS_DNA.md).

## A chi serve

Il viaggiatore che vuole organizzare da sé un viaggio (non un tour operator), che ha già in mente una lista di posti o la sta costruendo, e che vuole un itinerario giorno-per-giorno realistico senza dover fare a mano i calcoli di distanza, orari e ritmo. Non è pensato per la prenotazione last-minute né per il turismo di massa pacchettizzato.

## Orizzonte del prodotto

- **Fase 1 (oggi)**: catalogo di luoghi, libreria personale, composizione automatica della giornata (Journey Composer + Rule Engine), tracking in tempo reale, punteggio di qualità del viaggio.
- **Fase 2**: motori di dominio aggiuntivi — Budget, Memories/Recap, e soprattutto il Traveler DNA (ADR-014) — dietro le stesse interfacce architetturali già in uso oggi (Engine → Event Bus → Context Engine).
- **Fase 3**: AI Concierge, costruito *sopra* il Traveler DNA e non al suo posto — vedi [AI_ARCHITECTURE.md](../architecture/AI_ARCHITECTURE.md) per perché questo ordine non è negoziabile.

Per i principi che guidano ogni decisione lungo questo percorso, vedi [PRODUCT_PRINCIPLES.md](PRODUCT_PRINCIPLES.md).
