import { GeoLocation, JourneyAnchor } from '../../core/engines/types/context.types';
import { Transport, Accommodation, HotelPolicy } from '../trip/models/trip-setup.model';

/**
 * ============================================================================
 * LUGGAGE PLANNING SERVICE (ADR-023, Sprint 18 — Fase 4)
 * ============================================================================
 * Deriva gli anchor logistici dei bagagli — deposito, ritiro e rientro in
 * struttura — a partire da Transport, Accommodation e HotelPolicy. È un
 * servizio puro e stateless: nessun accesso a storage, nessun effetto
 * collaterale, output funzione deterministica degli input.
 *
 * Confini architetturali (invarianti di questa fase):
 * - NON conosce TimelineEngine.
 * - NON conosce JourneyComposer.
 * - NON conosce RuleEngine.
 * Il servizio si limita a produrre una sequenza ordinata di JourneyAnchor;
 * chi li consuma (in una fase successiva) è responsabile della loro adozione.
 *
 * Scelta consapevole: gli anchor prodotti da questo servizio sono `luggage_*`
 * e `accommodation_return`. NON genera arrival/check_in/check_out/departure:
 * quelli restano di competenza di JourneyAnchorEngine (che questo servizio non
 * conosce). I due insiemi sono complementari e vengono uniti a valle.
 *
 * Riferimento temporale: le date (`date`) sono derivate in UTC, coerenti con
 * il modo in cui LuggageStateCalculator interpreta i confini di giornata
 * (`${dateStr}T00:00:00.000Z`). Questo mantiene deterministico il
 * comportamento indipendentemente dal fuso orario della macchina.
 */

// Durata forfettaria di un'operazione bagagli (deposito/ritiro/rientro).
const LUGGAGE_HANDLING_MINUTES = 15;

function toGeoLocation(coords?: { lat: number; lng: number }): GeoLocation | undefined {
  return coords ? { latitude: coords.lat, longitude: coords.lng } : undefined;
}

function dateStrOfUTC(iso: string): string {
  const d = new Date(iso);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class LuggagePlanningService {
  /**
   * Deriva la sequenza ordinata cronologicamente di anchor logistici bagagli.
   *
   * @param transports      Tratte di viaggio (arrivo/partenza). L'ordine tra
   *                        tratte multiple si deduce da `departureDate`.
   * @param accommodations  Alloggi del viaggio. Il primo per `checkIn` guida
   *                        l'arrivo, l'ultimo per `checkIn` la partenza.
   * @param hotelPolicy     Policy applicabile. Se `allowsLuggageDropoff` non è
   *                        esplicitamente `true`, nessun anchor viene generato.
   * @returns               JourneyAnchor[] ordinati per `startISO` crescente.
   */
  public static buildLuggageAnchors(
    transports: Transport[],
    accommodations: Accommodation[],
    hotelPolicy?: HotelPolicy
  ): JourneyAnchor[] {
    const anchors: JourneyAnchor[] = [];

    const handlingMs = LUGGAGE_HANDLING_MINUTES * 60000;

    const sortedTransports = [...(transports || [])].sort(
      (a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
    );
    const sortedAccommodations = [...(accommodations || [])].sort(
      (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
    );

    const arrivalTransport = sortedTransports[0];
    // Coerente con JourneyAnchorEngine: con una sola tratta il viaggio è di
    // sola andata e non produce anchor di partenza.
    const departureTransport =
      sortedTransports.length > 1 ? sortedTransports[sortedTransports.length - 1] : undefined;
    const firstAccommodation = sortedAccommodations[0];
    const lastAccommodation =
      sortedAccommodations.length > 0 ? sortedAccommodations[sortedAccommodations.length - 1] : undefined;

    // Regola 2: consultiamo la policy specifica dell'alloggio in esame,
    // con fallback sul parametro globale se la struttura non ha una policy propria.
    const firstPolicy = firstAccommodation?.hotelPolicy ?? hotelPolicy;
    const lastPolicy = lastAccommodation?.hotelPolicy ?? hotelPolicy;

    // ------------------------------------------------------------------
    // Regola 1: arrivo prima del check-in → deposito bagagli in struttura.
    // arrivo ↓ luggage_dropoff ↓ (tempo libero) ↓ check_in
    // Il check_in (generato altrove) riporta lo stato a NONE: qui basta il
    // solo deposito perché il viaggiatore giri leggero fino al check-in.
    // ------------------------------------------------------------------
    if (arrivalTransport && firstAccommodation && firstPolicy?.allowsLuggageDropoff === true) {
      // Senza arrivalDate nota, l'unico istante certo è la partenza della
      // tratta di arrivo (coerente con JourneyAnchorEngine).
      const arrivalISO = new Date(arrivalTransport.arrivalDate || arrivalTransport.departureDate).toISOString();
      const checkInISO = new Date(firstAccommodation.checkIn).toISOString();
      const arrivalMs = new Date(arrivalISO).getTime();
      const checkInMs = new Date(checkInISO).getTime();

      if (arrivalMs < checkInMs) {
        // Il deposito avviene appena possibile per massimizzare il tempo
        // libero senza bagagli. `endISO` è limitato al check-in per non
        // sovrapporsi ad esso (Regola 4).
        const dropoffStartISO = arrivalISO;
        const dropoffEndISO = new Date(Math.min(arrivalMs + handlingMs, checkInMs)).toISOString();

        anchors.push({
          id: `anchor-luggage-dropoff-arrival-${firstAccommodation.id}`,
          kind: 'luggage_dropoff',
          label: `Deposito bagagli — ${firstAccommodation.name}`,
          date: dateStrOfUTC(dropoffStartISO),
          startISO: dropoffStartISO,
          endISO: dropoffEndISO,
          coordinates: toGeoLocation(firstAccommodation.coordinates),
          sourceType: 'derived',
          sourceId: firstAccommodation.id,
        });
      }
    }

    // ------------------------------------------------------------------
    // Regola 3: check-out molto prima della partenza → deposito, giro
    // leggero, rientro in struttura e ritiro prima di andare in aeroporto.
    // check_out ↓ luggage_dropoff ↓ (tempo libero) ↓ accommodation_return ↓
    //   luggage_pickup ↓ departure
    // Servono almeno due operazioni bagagli nella finestra per non generare
    // anchor sovrapposti (Regola 4); il rientro si aggiunge solo se ci sta.
    // ------------------------------------------------------------------
    if (departureTransport && lastAccommodation && lastPolicy?.allowsLuggageDropoff === true) {
      const checkOutISO = new Date(lastAccommodation.checkOut).toISOString();
      const departureISO = new Date(departureTransport.departureDate).toISOString();
      const checkOutMs = new Date(checkOutISO).getTime();
      const departureMs = new Date(departureISO).getTime();
      const windowMs = departureMs - checkOutMs;

      if (checkOutMs < departureMs && windowMs >= 2 * handlingMs) {
        // Deposito subito dopo il check-out.
        const dropoffStartMs = checkOutMs;
        const dropoffEndMs = checkOutMs + handlingMs;

        // Ritiro appena prima della partenza.
        const pickupEndMs = departureMs;
        const pickupStartMs = departureMs - handlingMs;

        anchors.push({
          id: `anchor-luggage-dropoff-departure-${lastAccommodation.id}`,
          kind: 'luggage_dropoff',
          label: `Deposito bagagli post check-out — ${lastAccommodation.name}`,
          date: dateStrOfUTC(new Date(dropoffStartMs).toISOString()),
          startISO: new Date(dropoffStartMs).toISOString(),
          endISO: new Date(dropoffEndMs).toISOString(),
          coordinates: toGeoLocation(lastAccommodation.coordinates),
          sourceType: 'derived',
          sourceId: lastAccommodation.id,
        });

        // accommodation_return — solo se determinabile: c'è spazio tra il
        // deposito e il ritiro (finestra ≥ 3 operazioni) e conosciamo la
        // posizione della struttura. Rappresenta il rientro per recuperare i
        // bagagli depositati, appena prima del ritiro.
        const returnEndMs = pickupStartMs;
        const returnStartMs = returnEndMs - handlingMs;
        if (returnStartMs >= dropoffEndMs && lastAccommodation.coordinates) {
          anchors.push({
            id: `anchor-accommodation-return-${lastAccommodation.id}`,
            kind: 'accommodation_return',
            label: `Rientro in struttura — ${lastAccommodation.name}`,
            date: dateStrOfUTC(new Date(returnStartMs).toISOString()),
            startISO: new Date(returnStartMs).toISOString(),
            endISO: new Date(returnEndMs).toISOString(),
            coordinates: toGeoLocation(lastAccommodation.coordinates),
            sourceType: 'derived',
            sourceId: lastAccommodation.id,
          });
        }

        anchors.push({
          id: `anchor-luggage-pickup-departure-${lastAccommodation.id}`,
          kind: 'luggage_pickup',
          label: `Ritiro bagagli — ${lastAccommodation.name}`,
          date: dateStrOfUTC(new Date(pickupStartMs).toISOString()),
          startISO: new Date(pickupStartMs).toISOString(),
          endISO: new Date(pickupEndMs).toISOString(),
          coordinates: toGeoLocation(lastAccommodation.coordinates),
          sourceType: 'derived',
          sourceId: lastAccommodation.id,
        });
      }
    }

    // Regola 8: sequenza sempre ordinata cronologicamente.
    anchors.sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime());

    return anchors;
  }
}
