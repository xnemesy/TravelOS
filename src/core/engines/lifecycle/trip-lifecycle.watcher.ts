import { Trip, TripStatus } from '../../../domain/trip/models/trip.model';
import { TripCalculator } from '../../travel-engine/trip-calculator';
import { ILocalDatabase } from '../../storage/local-database.interface';
import { DomainEvent, DomainFactType } from '../types/events.types';

/**
 * ============================================================================
 * TRIP LIFECYCLE WATCHER (Sprint 15 — ADR-015 §2.6, Domain Lifecycle)
 * ============================================================================
 * `TripCalculator.getTripStatus()` è una funzione pura, ricalcolata ad ogni
 * chiamata confrontando `now` con le date del trip — non esiste una
 * transizione di stato persistita a cui agganciare `TripStarted`/
 * `TripCompleted`. Questo watcher colma il divario: confronta lo stato
 * derivato corrente con l'ultimo stato osservato e persistito, e pubblica
 * il fatto di dominio corrispondente solo alla prima transizione rilevata.
 *
 * Fuori scope per questo sprint (decisione presa con l'utente, non ADR-015):
 * `TripCancelled` (nessuna azione nel repository scrive mai `status:
 * 'cancelled'` — un evento per quella transizione non avrebbe nulla da
 * annunciare) e `TripCreated` (già coperto da un'azione reale in
 * `trip.store.ts:createTrip`, non richiede un watcher fire-once). Un trip
 * il cui stato derivato è `cancelled`/`archived` viene quindi ignorato da
 * questo watcher, senza errori né side-effect.
 */

type WatchedStage = 'pre_start' | 'ongoing' | 'completed';

const STAGE_ORDER: WatchedStage[] = ['pre_start', 'ongoing', 'completed'];

const STAGE_EVENT: Record<Exclude<WatchedStage, 'pre_start'>, DomainFactType> = {
  ongoing: 'TripStarted',
  completed: 'TripCompleted',
};

interface StoredLifecycleState {
  stage: WatchedStage;
  observedAt: string; // ISO 8601
}

interface EventPublisher {
  publish<T>(event: DomainEvent<T>): void;
}

/**
 * Esportata solo per test diretto: `TripCalculator.getTripStatus()` non ha
 * mai un ramo che ritorna `'archived'` (a differenza di `'cancelled'`, che
 * è un corto circuito esplicito) — un trip archiviato viene quindi derivato
 * con la stessa logica a date di un trip normale. Quirk preesistente di
 * `TripCalculator`, fuori scope per questo sprint (non va corretto qui).
 * Questa funzione resta comunque difensiva sull'intero enum `TripStatus`,
 * testata in isolamento perché il ramo `'archived'` non è raggiungibile
 * passando per `checkTransition` + `TripCalculator` così come sono oggi.
 */
export function toWatchedStage(status: TripStatus): WatchedStage | null {
  switch (status) {
    case 'planned':
    case 'ready':
      return 'pre_start';
    case 'ongoing':
      return 'ongoing';
    case 'completed':
      return 'completed';
    case 'cancelled':
    case 'archived':
      return null; // fuori scope — vedi doc-comment della classe
  }
}

export class TripLifecycleWatcher {
  // Serializza le chiamate concorrenti per lo stesso tripId: senza questa
  // coda, due `checkTransition` ravvicinate sullo stesso trip potrebbero
  // entrambe leggere lo stesso stato persistito "vecchio" prima che la prima
  // scrittura si completi, e pubblicare due volte lo stesso fatto —
  // violazione diretta del requisito "esattamente una volta per transizione".
  private pending: Map<string, Promise<void>> = new Map();

  constructor(
    private readonly storage: ILocalDatabase,
    private readonly eventBus: EventPublisher
  ) {}

  private storageKey(tripId: string): string {
    return `trip_lifecycle_${tripId}`;
  }

  /**
   * Osserva lo stato derivato corrente di `trip` e pubblica esattamente un
   * fatto di dominio per ciascuna transizione realmente attraversata dalla
   * prima osservazione mai fatta ad oggi. Deterministico: stesso `trip` +
   * stesso `now` + stesso stato persistito → stesso risultato, sempre.
   * Idempotente: chiamate ripetute senza una transizione reale non
   * pubblicano nulla e non riscrivono lo storage.
   */
  public async checkTransition(trip: Trip, now: Date = new Date()): Promise<void> {
    const previous = this.pending.get(trip.id) ?? Promise.resolve();
    const next = previous
      .then(() => this.runCheck(trip, now))
      .catch((error) => {
        console.error(`[TripLifecycleWatcher] Errore durante l'osservazione del trip ${trip.id}:`, error);
      });
    this.pending.set(trip.id, next);
    return next;
  }

  private async runCheck(trip: Trip, now: Date): Promise<void> {
    const currentStatus = TripCalculator.getTripStatus(trip, now);
    const currentStage = toWatchedStage(currentStatus);
    if (currentStage === null) {
      // cancelled/archived: fuori scope, nessun evento, nessuna scrittura —
      // non "consuma" una transizione osservabile in futuro.
      return;
    }

    const key = this.storageKey(trip.id);
    const stored = await this.storage.get<StoredLifecycleState>(key);
    // Bootstrap: se non è mai stato osservato prima, la baseline è lo stato
    // persistito reale del trip (`trip.status`, tipicamente 'planned' per un
    // trip appena creato) — non lo stato derivato corrente. Così un trip
    // osservato per la prima volta molto dopo la sua creazione (es. dati
    // preesistenti, o un trip con date nel passato) attraversa comunque
    // ogni transizione intermedia invece di saltarla silenziosamente.
    const baselineStage = stored?.stage ?? toWatchedStage(trip.status) ?? 'pre_start';

    if (baselineStage === currentStage) {
      return; // nessuna transizione, no-op idempotente
    }

    const baselineIndex = STAGE_ORDER.indexOf(baselineStage);
    const currentIndex = STAGE_ORDER.indexOf(currentStage);

    // Solo transizioni in avanti generano fatti di dominio. Una transizione
    // all'indietro (es. l'utente estende `endDate` di un trip già
    // 'completed', che torna derivabile come 'ongoing') non pubblica un
    // fatto: non esiste un "TripReopened" in questo scope. Si allinea
    // silenziosamente la baseline, così una futura ri-transizione in avanti
    // verso 'completed' potrà comunque scatenare un nuovo `TripCompleted`.
    if (currentIndex > baselineIndex) {
      // Decisione di design esplicitamente lasciata aperta da ADR-015 §2.6:
      // se una o più transizioni vengono osservate per la prima volta tutte
      // insieme (es. l'app non è mai stata aperta durante l'intero arco del
      // viaggio, e il prossimo check avviene a trip già concluso), questo
      // watcher pubblica IN SEQUENZA un fatto per ciascuna tappa attraversata
      // — mai solo l'ultima. Preserva una storia di dominio completa per i
      // futuri consumer (Memory Engine, ADR-014) invece di un salto silenzioso.
      for (let i = baselineIndex + 1; i <= currentIndex; i++) {
        this.publishStageEntered(trip.id, STAGE_ORDER[i], now);
      }
    }

    await this.storage.set(key, { stage: currentStage, observedAt: now.toISOString() });
  }

  private publishStageEntered(tripId: string, stage: WatchedStage, now: Date): void {
    if (stage === 'pre_start') return; // nessun fatto di dominio per lo stato iniziale
    const type = STAGE_EVENT[stage];
    const isoNow = now.toISOString();

    this.eventBus.publish({
      id: `evt-${now.getTime()}-${stage}`,
      type,
      timestamp: isoNow,
      tripId,
      payload: type === 'TripStarted' ? { startedAt: isoNow } : { completedAt: isoNow },
    });
  }
}
