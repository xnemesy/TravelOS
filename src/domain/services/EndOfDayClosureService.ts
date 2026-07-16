import { JourneyAnchorKind } from '../../core/engines/types/context.types';
import { Accommodation, Transport } from '../trip/models/trip-setup.model';

/**
 * ============================================================================
 * END OF DAY CLOSURE SERVICE (ADR-024, Sprint 18 — Fase 6, Regola C)
 * ============================================================================
 * Risponde a UNA sola domanda, in modo puro e deterministico:
 *
 *   «Questa giornata deve chiudersi con un rientro all'alloggio?»
 *
 * Cosa NON fa (confini architetturali invarianti di questa fase):
 * - NON inserisce attività.
 * - NON modifica lo schedule.
 * - NON crea PlaceRef.
 * - NON genera anchor (`accommodation_return` o altri).
 * - NON conosce JourneyComposer, TimelineEngine né RuleEngine.
 *
 * Si limita a DECIDERE. Il chiamante (in una fase successiva) resta l'unico
 * responsabile di come usare la decisione — se e come materializzare l'anchor
 * `accommodation_return`. Il servizio è stateless: nessun accesso a storage,
 * nessun effetto collaterale, output funzione deterministica degli input.
 *
 * Riferimento temporale: i confini di giornata sono valutati in UTC
 * (`YYYY-MM-DD`), coerentemente con LuggagePlanningService e
 * LuggageStateCalculator, così che il comportamento sia indipendente dal fuso
 * orario della macchina.
 *
 * Le quattro regole implementate (Regola C, ADR-024 §2.3, e vincoli Sprint 18):
 *  - Regola A: se la giornata termina già con un nodo di chiusura
 *    (check_in / check_out / departure_* / accommodation_return) → false.
 *  - Regola B: se il viaggiatore dorme nello stesso alloggio quella notte e non
 *    esiste ancora un rientro esplicito → true (salvo Regola D).
 *  - Regola C: nessun rientro in caso di cambio alloggio, pernottamento altrove,
 *    trasporto notturno o giorno di partenza.
 *  - Regola D: rientro solo se resta tempo sufficiente (soglia minima
 *    configurabile, default 30 minuti). Mai forzare rientri impossibili.
 */

// Soglia minima di finestra libera (in minuti) per giustificare un rientro.
const DEFAULT_MINIMUM_REMAINING_MINUTES = 30;
// Fine giornata di default: 24:00 espresso in minuti dalla mezzanotte.
const DEFAULT_DAY_END_MINUTES = 24 * 60;

/**
 * Kind che, se rappresentano l'ULTIMO nodo della giornata, chiudono già la
 * giornata: in loro presenza nessun `accommodation_return` va aggiunto
 * (Regola A). Nota: `arrival_*` e `transfer` NON sono di chiusura — dopo un
 * arrivo la giornata può ancora prevedere attività e un rientro serale.
 */
const CLOSING_LAST_NODE_KINDS: ReadonlySet<JourneyAnchorKind> = new Set<JourneyAnchorKind>([
  'check_in',
  'check_out',
  'departure_transfer',
  'departure_airport',
  'departure_flight',
  'accommodation_return',
]);

/**
 * Codici di motivazione della decisione — stabili e testabili, distinti dalla
 * prosa umana di `reason`. Pensati per l'osservabilità (PlanningReport) senza
 * accoppiare i test a stringhe libere.
 */
export type EndOfDayClosureReasonCode =
  | 'RETURN_REQUIRED' // true: rientro necessario
  | 'DAY_ALREADY_CLOSED' // Regola A
  | 'HOTEL_CHANGE' // Regola C
  | 'OVERNIGHT_TRANSPORT' // Regola C
  | 'DEPARTURE_DAY' // Regola C
  | 'SLEEPING_ELSEWHERE' // Regola C (nessun alloggio quella notte)
  | 'INSUFFICIENT_TIME'; // Regola D

export interface EndOfDayClosureQuery {
  /** Giorno di calendario valutato (`YYYY-MM-DD`, UTC). */
  dateStr: string;
  /**
   * Kind dell'ULTIMO nodo già pianificato della giornata, se è un anchor.
   * `undefined` significa che l'ultimo nodo è un'attività ordinaria (nessuna
   * chiusura strutturale). È l'unico dato necessario per la Regola A: il
   * chiamante conosce il proprio ultimo `PlaceRef` e il suo `journeyAnchorKind`.
   */
  lastNodeAnchorKind?: JourneyAnchorKind;
  /**
   * Alloggi del viaggio: determinano dove il viaggiatore dorme quella notte
   * (Regola B) e se la giornata è un cambio alloggio (Regola C).
   */
  accommodations: Accommodation[];
  /**
   * Tratte del viaggio (opzionale): usate per distinguere trasporto notturno e
   * giorno di partenza, affinando la motivazione. Non cambiano l'esito booleano,
   * che resta robusto anche senza trasporti (la copertura notturna dell'alloggio
   * è il segnale primario).
   */
  transports?: Transport[];
  /** Minuti dalla mezzanotte in cui termina l'ultimo nodo pianificato (Regola D). */
  lastActivityEndMinutes: number;
  /** Ultimo minuto a cui la giornata può estendersi (default 1440 = 24:00). */
  dayEndMinutes?: number;
  /**
   * Minuti stimati per rientrare all'alloggio, se noti al chiamante (Regola D):
   * il rientro non viene proposto se non c'è tempo materiale per compierlo.
   */
  returnTravelMinutes?: number;
  /** Finestra libera minima richiesta per giustificare un rientro (default 30). */
  minimumRemainingMinutes?: number;
}

export interface EndOfDayClosureDecision {
  /** true se la giornata deve chiudersi con un rientro all'alloggio. */
  shouldReturn: boolean;
  /** Codice stabile della motivazione (osservabilità/PlanningReport). */
  reasonCode: EndOfDayClosureReasonCode;
  /** Motivazione leggibile da persona/AI. */
  reason: string;
}

function toDateStrUTC(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class EndOfDayClosureService {
  /**
   * Predicato puro headline: la giornata deve terminare con un rientro
   * all'alloggio? Delega a `evaluate` e ne restituisce il solo esito booleano.
   */
  public static shouldReturnToAccommodation(query: EndOfDayClosureQuery): boolean {
    return this.evaluate(query).shouldReturn;
  }

  /**
   * Valuta la decisione completa (esito + motivazione), sempre in modo puro e
   * deterministico. Stessa logica di `shouldReturnToAccommodation`, ma con la
   * motivazione a supporto dell'osservabilità.
   */
  public static evaluate(query: EndOfDayClosureQuery): EndOfDayClosureDecision {
    const {
      dateStr,
      lastNodeAnchorKind,
      accommodations,
      transports,
      lastActivityEndMinutes,
    } = query;

    // ------------------------------------------------------------------
    // Regola A — la giornata è già chiusa da un nodo terminale.
    // check_in/check_out/departure_* chiudono la giornata; un
    // accommodation_return preesistente significa che il rientro c'è già.
    // ------------------------------------------------------------------
    if (lastNodeAnchorKind && CLOSING_LAST_NODE_KINDS.has(lastNodeAnchorKind)) {
      return {
        shouldReturn: false,
        reasonCode: 'DAY_ALREADY_CLOSED',
        reason: `La giornata termina già con un nodo di chiusura (${lastNodeAnchorKind}): nessun rientro aggiuntivo.`,
      };
    }

    const acc = accommodations || [];

    // ------------------------------------------------------------------
    // Regola C — cambio alloggio: un alloggio esce e un altro entra nello
    // stesso giorno. La giornata si chiude sul nuovo check-in, non su un
    // rientro al vecchio alloggio.
    // ------------------------------------------------------------------
    const checkingOutToday = acc.filter((a) => toDateStrUTC(a.checkOut) === dateStr);
    const checkingInToday = acc.filter((a) => toDateStrUTC(a.checkIn) === dateStr);
    const isHotelChange =
      checkingOutToday.length > 0 &&
      checkingInToday.some((ci) => !checkingOutToday.some((co) => co.id === ci.id));
    if (isHotelChange) {
      return {
        shouldReturn: false,
        reasonCode: 'HOTEL_CHANGE',
        reason: 'Cambio alloggio nello stesso giorno: la giornata si chiude sul nuovo check-in.',
      };
    }

    // ------------------------------------------------------------------
    // Regola C — trasporto notturno: una tratta attraversa la notte di questo
    // giorno (parte il giorno stesso o prima, arriva dopo). Il viaggiatore
    // dorme in viaggio, non c'è alloggio a cui rientrare.
    // ------------------------------------------------------------------
    const overnightTransport = (transports || []).find((t) => {
      const dep = toDateStrUTC(t.departureDate);
      const arr = t.arrivalDate ? toDateStrUTC(t.arrivalDate) : dep;
      return dep <= dateStr && arr > dateStr;
    });
    if (overnightTransport) {
      return {
        shouldReturn: false,
        reasonCode: 'OVERNIGHT_TRANSPORT',
        reason: 'Pernottamento in transito (trasporto notturno): nessun alloggio a cui rientrare.',
      };
    }

    // ------------------------------------------------------------------
    // Regola B / C — dorme nello stesso alloggio quella notte?
    // Copertura notturna: check-in entro il giorno e check-out successivo al
    // giorno. Se nessun alloggio copre la notte → giorno di partenza o
    // pernottamento altrove: nessun rientro.
    // ------------------------------------------------------------------
    const nightAccommodation = acc.find(
      (a) => toDateStrUTC(a.checkIn) <= dateStr && toDateStrUTC(a.checkOut) > dateStr
    );

    if (!nightAccommodation) {
      const departsToday = (transports || []).some((t) => toDateStrUTC(t.departureDate) === dateStr);
      if (departsToday || checkingOutToday.length > 0) {
        return {
          shouldReturn: false,
          reasonCode: 'DEPARTURE_DAY',
          reason: 'Giorno di partenza: il viaggiatore lascia la destinazione, nessun rientro serale.',
        };
      }
      return {
        shouldReturn: false,
        reasonCode: 'SLEEPING_ELSEWHERE',
        reason: 'Nessun alloggio copre questa notte: il viaggiatore dorme altrove.',
      };
    }

    // ------------------------------------------------------------------
    // Regola D — c'è abbastanza tempo residuo per un rientro sensato?
    // Mai forzare rientri impossibili: serve almeno la soglia minima e, se
    // noto, il tempo materiale per il tragitto di rientro.
    // ------------------------------------------------------------------
    const dayEndMinutes = query.dayEndMinutes ?? DEFAULT_DAY_END_MINUTES;
    const minimumRemaining = query.minimumRemainingMinutes ?? DEFAULT_MINIMUM_REMAINING_MINUTES;
    const requiredMinutes = Math.max(minimumRemaining, query.returnTravelMinutes ?? 0);
    const remainingMinutes = dayEndMinutes - lastActivityEndMinutes;

    if (remainingMinutes < requiredMinutes) {
      return {
        shouldReturn: false,
        reasonCode: 'INSUFFICIENT_TIME',
        reason: `Tempo residuo insufficiente (${remainingMinutes} min < ${requiredMinutes} min richiesti): rientro non forzato.`,
      };
    }

    // Regola B soddisfatta: dorme in struttura, nessun rientro esplicito ancora,
    // tempo sufficiente → la giornata deve chiudersi con un rientro.
    return {
      shouldReturn: true,
      reasonCode: 'RETURN_REQUIRED',
      reason: `Pernottamento in ${nightAccommodation.name}: la giornata deve chiudersi con un rientro all'alloggio.`,
    };
  }
}
