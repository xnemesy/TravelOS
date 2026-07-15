import { GeoLocation, JourneyAnchor, JourneyAnchorKind, PlaceRef } from '../../core/engines/types/context.types';
import { Transport, Accommodation } from '../trip/models/trip-setup.model';

/**
 * ============================================================================
 * JOURNEY ANCHOR ENGINE
 * ============================================================================
 * Deriva i Journey Anchors — i punti strutturali immutabili di un viaggio
 * (arrivo, transfer, check-in/out, partenza) — da Transport e Accommodation
 * (TripSetup, ADR-018). Servizio puro, senza stato: nessuna dipendenza da
 * Engine/storage, coerente con DistanceCalculator.
 *
 * Un Journey Anchor rappresenta un istante reale (volo, check-in...) che il
 * JourneyComposer non deve mai ricalcolare: la sua ora è quella del mondo
 * reale, non quella derivata dall'accumulo di distanze/durate della giornata.
 * Il Composer si limita a non pianificare attività prima del primo anchor
 * "di arrivo" né dopo il primo anchor "di partenza" di ciascuna giornata.
 *
 * Limite consapevole (MVP): con più tratte Transport, la prima per
 * departureDate è trattata come arrivo alla destinazione e l'ultima come
 * partenza. Con una sola tratta, è trattata come sola andata (arrivo): un
 * viaggio di sola andata non genera anchor di partenza, comportamento
 * corretto per un trip a senso unico.
 */

const TRANSFER_DEFAULT_MINUTES = 45;
const AIRPORT_BUFFER_MINUTES = 120; // check-in/security prima del volo di partenza

const ARRIVAL_KINDS = new Set<JourneyAnchorKind>(['arrival_flight', 'arrival_airport', 'transfer', 'check_in']);
const DEPARTURE_KINDS = new Set<JourneyAnchorKind>([
  'check_out',
  'departure_transfer',
  'departure_airport',
  'departure_flight',
]);

function toGeoLocation(coords?: { lat: number; lng: number }): GeoLocation | undefined {
  return coords ? { latitude: coords.lat, longitude: coords.lng } : undefined;
}

function dateStrOf(iso: string): string {
  const d = new Date(iso);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function minutesOfISO(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function addMinutesISO(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

export class JourneyAnchorEngine {

  /**
   * Deriva la sequenza ordinata di Journey Anchor del viaggio da transports e
   * accommodations. Nessun accesso a storage: input/output puri.
   */
  public static buildTripAnchors(transports: Transport[], accommodations: Accommodation[]): JourneyAnchor[] {
    const anchors: JourneyAnchor[] = [];

    const sortedTransports = [...(transports || [])].sort(
      (a, b) => new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
    );
    const sortedAccommodations = [...(accommodations || [])].sort(
      (a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime()
    );

    const arrivalTransport = sortedTransports[0];
    const departureTransport =
      sortedTransports.length > 1 ? sortedTransports[sortedTransports.length - 1] : undefined;
    const firstAccommodation = sortedAccommodations[0];
    const lastAccommodation =
      sortedAccommodations.length > 0 ? sortedAccommodations[sortedAccommodations.length - 1] : undefined;

    let arrivalAirportISO: string | undefined;

    if (arrivalTransport) {
      const startISO = arrivalTransport.departureDate.toISOString();
      // Senza arrivalDate nota, l'unico istante certo è la partenza: l'arrivo
      // reale resta ignoto finché il TripSetup non lo specifica.
      const endISO = (arrivalTransport.arrivalDate || arrivalTransport.departureDate).toISOString();
      arrivalAirportISO = endISO;

      anchors.push({
        id: `anchor-arrival-flight-${arrivalTransport.id}`,
        kind: 'arrival_flight',
        label: `Arrivo ${arrivalTransport.mode === 'flight' ? 'in volo' : 'in transito'} a ${arrivalTransport.destination}`,
        date: dateStrOf(startISO),
        startISO,
        endISO,
        sourceType: 'transport',
        sourceId: arrivalTransport.id,
      });

      anchors.push({
        id: `anchor-arrival-airport-${arrivalTransport.id}`,
        kind: 'arrival_airport',
        label: 'Sbarco e ritiro bagagli',
        date: dateStrOf(endISO),
        startISO: endISO,
        endISO,
        sourceType: 'derived',
        sourceId: arrivalTransport.id,
      });
    }

    let transferEndISO: string | undefined;
    let transferEndCandidate: string | undefined;

    if (arrivalAirportISO && firstAccommodation) {
      const transferStartISO = arrivalAirportISO;
      const checkInISO = firstAccommodation.checkIn.toISOString();
      transferEndCandidate = addMinutesISO(transferStartISO, TRANSFER_DEFAULT_MINUTES);
      transferEndISO = transferEndCandidate;
      if (new Date(transferEndCandidate) > new Date(checkInISO) && new Date(transferStartISO) < new Date(checkInISO)) {
        transferEndISO = checkInISO;
      }

      anchors.push({
        id: `anchor-transfer-in-${firstAccommodation.id}`,
        kind: 'transfer',
        label: `Trasferimento verso ${firstAccommodation.name}`,
        date: dateStrOf(transferStartISO),
        startISO: transferStartISO,
        endISO: transferEndISO,
        coordinates: toGeoLocation(firstAccommodation.coordinates),
        sourceType: 'derived',
        sourceId: firstAccommodation.id,
      });
    }

    if (firstAccommodation) {
      const checkInISO = firstAccommodation.checkIn.toISOString();
      let effectiveCheckInISO = checkInISO;
      if (transferEndCandidate && new Date(checkInISO) < new Date(transferEndCandidate)) {
        effectiveCheckInISO = transferEndCandidate;
      }

      anchors.push({
        id: `anchor-check-in-${firstAccommodation.id}`,
        kind: 'check_in',
        label: `Check-in — ${firstAccommodation.name}`,
        date: dateStrOf(effectiveCheckInISO),
        startISO: effectiveCheckInISO,
        endISO: addMinutesISO(effectiveCheckInISO, 15),
        coordinates: toGeoLocation(firstAccommodation.coordinates),
        sourceType: 'accommodation',
        sourceId: firstAccommodation.id,
      });
    }

    if (lastAccommodation) {
      const checkOutISO = lastAccommodation.checkOut.toISOString();
      anchors.push({
        id: `anchor-check-out-${lastAccommodation.id}`,
        kind: 'check_out',
        label: `Check-out — ${lastAccommodation.name}`,
        date: dateStrOf(checkOutISO),
        startISO: addMinutesISO(checkOutISO, -15),
        endISO: checkOutISO,
        coordinates: toGeoLocation(lastAccommodation.coordinates),
        sourceType: 'accommodation',
        sourceId: lastAccommodation.id,
      });
    }

    if (departureTransport) {
      const departureFlightStartISO = departureTransport.departureDate.toISOString();
      const departureAirportStartISO = addMinutesISO(departureFlightStartISO, -AIRPORT_BUFFER_MINUTES);
      const departureTransferEndISO = departureAirportStartISO;
      const departureTransferStartISO = addMinutesISO(departureTransferEndISO, -TRANSFER_DEFAULT_MINUTES);

      anchors.push({
        id: `anchor-departure-transfer-${departureTransport.id}`,
        kind: 'departure_transfer',
        label: `Trasferimento verso ${departureTransport.mode === 'flight' ? "l'aeroporto" : 'la partenza'}`,
        date: dateStrOf(departureTransferStartISO),
        startISO: departureTransferStartISO,
        endISO: departureTransferEndISO,
        coordinates: lastAccommodation ? toGeoLocation(lastAccommodation.coordinates) : undefined,
        sourceType: 'derived',
        sourceId: departureTransport.id,
      });

      anchors.push({
        id: `anchor-departure-airport-${departureTransport.id}`,
        kind: 'departure_airport',
        label: 'Check-in aeroportuale e sicurezza',
        date: dateStrOf(departureAirportStartISO),
        startISO: departureAirportStartISO,
        endISO: departureFlightStartISO,
        sourceType: 'derived',
        sourceId: departureTransport.id,
      });

      anchors.push({
        id: `anchor-departure-flight-${departureTransport.id}`,
        kind: 'departure_flight',
        label: `Partenza ${departureTransport.mode === 'flight' ? 'in volo' : 'in transito'} da ${departureTransport.origin || departureTransport.destination}`,
        date: dateStrOf(departureFlightStartISO),
        startISO: departureFlightStartISO,
        endISO: (departureTransport.arrivalDate || departureTransport.departureDate).toISOString(),
        sourceType: 'transport',
        sourceId: departureTransport.id,
      });
    }

    return anchors;
  }

  public static getAnchorsForDate(anchors: JourneyAnchor[], dateStr: string): JourneyAnchor[] {
    const dayStartMs = new Date(`${dateStr}T00:00:00.000Z`).getTime();
    const dayEndMs = new Date(`${dateStr}T23:59:59.999Z`).getTime();

    return anchors.filter((a) => {
      if (a.date === dateStr) return true;
      const startMs = new Date(a.startISO).getTime();
      const endMs = new Date(a.endISO).getTime();
      return startMs <= dayEndMs && endMs > dayStartMs;
    });
  }

  /**
   * Calcola la finestra oraria in cui il Composer può posizionare attività
   * flessibili nella giornata indicata. `null` significa "nessun vincolo":
   * la giornata non è né il giorno di arrivo né quello di partenza.
   * Regola non negoziabile: nessuna attività prima di `startMinutes`
   * (arrivo/transfer/check-in) né dopo `endMinutes` (check-out/transfer/
   * aeroporto/volo di partenza). Se un anchor attraversa la mezzanotte,
   * il calcolo considera la porzione prescritta alla singola giornata (BUG 3).
   */
  public static getDayActivityWindow(
    anchors: JourneyAnchor[],
    dateStr: string
  ): { startMinutes: number; endMinutes: number } | null {
    const dayAnchors = this.getAnchorsForDate(anchors, dateStr);
    if (dayAnchors.length === 0) return null;

    const dayStartMs = new Date(`${dateStr}T00:00:00.000Z`).getTime();
    const dayEndMs = new Date(`${dateStr}T24:00:00.000Z`).getTime();

    const arrivalBoundaries = dayAnchors
      .filter((a) => ARRIVAL_KINDS.has(a.kind))
      .map((a) => {
        const sliceEndMs = Math.min(new Date(a.endISO).getTime(), dayEndMs);
        return Math.min(1440, Math.max(0, Math.round((sliceEndMs - dayStartMs) / 60000)));
      });

    const departureBoundaries = dayAnchors
      .filter((a) => DEPARTURE_KINDS.has(a.kind))
      .map((a) => {
        const sliceStartMs = Math.max(new Date(a.startISO).getTime(), dayStartMs);
        return Math.min(1440, Math.max(0, Math.round((sliceStartMs - dayStartMs) / 60000)));
      });

    if (arrivalBoundaries.length === 0 && departureBoundaries.length === 0) return null;

    return {
      startMinutes: arrivalBoundaries.length > 0 ? Math.max(...arrivalBoundaries) : 0,
      endMinutes: departureBoundaries.length > 0 ? Math.min(...departureBoundaries) : 24 * 60 - 1,
    };
  }

  /**
   * Proietta gli anchor della giornata come blocchi PlaceRef immutabili
   * (isBlock + isLocked + scheduledTime), pronti per essere iniettati dal
   * JourneyComposer. Se l'anchor attraversa la mezzanotte, viene proiettata solo
   * la porzione temporale ed il segmento della giornata di calendario indicata (BUG 3).
   */
  public static toPlaceRefs(anchors: JourneyAnchor[], dateStr: string): PlaceRef[] {
    const dayStartMs = new Date(`${dateStr}T00:00:00.000Z`).getTime();
    const dayEndMs = new Date(`${dateStr}T24:00:00.000Z`).getTime();

    return this.getAnchorsForDate(anchors, dateStr)
      .sort((a, b) => new Date(a.startISO).getTime() - new Date(b.startISO).getTime())
      .map((anchor) => {
        const startMs = Math.max(new Date(anchor.startISO).getTime(), dayStartMs);
        const endMs = Math.min(new Date(anchor.endISO).getTime(), dayEndMs);
        const durationMinutes = Math.max(
          5,
          Math.round((endMs - startMs) / 60000)
        );
        const crossesMidnight = dateStrOf(anchor.startISO) !== dateStrOf(anchor.endISO);
        const startMinutes = Math.round((startMs - dayStartMs) / 60000);
        const endMinutes = Math.round((endMs - dayStartMs) / 60000);
        const formatM = (mins: number) => {
          if (mins >= 1440) return '23:59';
          const h = Math.floor(mins / 60) % 24;
          const m = mins % 60;
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        };
        return {
          id: crossesMidnight ? `${anchor.id}-${dateStr}` : anchor.id,
          name: anchor.label,
          category: anchor.kind,
          coordinates: anchor.coordinates,
          isBlock: true,
          isLocked: true,
          scheduledTime: new Date(startMs).toISOString(),
          calculatedStartTime: formatM(startMinutes),
          calculatedEndTime: formatM(endMinutes),
          durationMinutes,
          role: anchor.kind === 'transfer' || anchor.kind === 'departure_transfer' ? 'transfer' : 'anchor',
          anchorType: 'HARD',
          journeyAnchorKind: anchor.kind,
        } as PlaceRef;
      });
  }

  public static isArrivalAnchorKind(kind?: string): boolean {
    return !!kind && ARRIVAL_KINDS.has(kind as JourneyAnchorKind);
  }

  public static isDepartureAnchorKind(kind?: string): boolean {
    return !!kind && DEPARTURE_KINDS.has(kind as JourneyAnchorKind);
  }
}
