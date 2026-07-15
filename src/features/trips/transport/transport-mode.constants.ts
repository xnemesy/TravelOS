import { Ionicons } from '@expo/vector-icons';
import { TransportMode } from '../../../domain/trip/models/trip-setup.model';

export interface TransportModeMeta {
  mode: TransportMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * I 5 mezzi di trasporto selezionabili in questo modulo (richiesta esplicita:
 * Flight/Train/Car/Bus/Other). `TransportModeSchema` (ADR-018 §3.1) include
 * anche `ferry` — non rimosso dal dominio (nessuna riscrittura di un
 * invariante già deciso), solo non offerto come opzione nel form di questo
 * modulo. Un `Transport` con `mode: 'ferry'` creato da un'altra fonte resta
 * valido e viene comunque visualizzato correttamente da `TransportCard`
 * (vedi `TRANSPORT_MODE_DISPLAY` sotto, che copre tutto l'enum).
 */
export const TRANSPORT_MODE_OPTIONS: TransportModeMeta[] = [
  { mode: 'flight', label: 'Volo', icon: 'airplane' },
  { mode: 'train', label: 'Treno', icon: 'train' },
  { mode: 'car', label: 'Auto', icon: 'car' },
  { mode: 'bus', label: 'Bus', icon: 'bus' },
  { mode: 'other', label: 'Altro', icon: 'ellipsis-horizontal-circle' },
];

/** Copre l'intero enum di dominio (inclusa `ferry`) per la sola visualizzazione. */
const TRANSPORT_MODE_DISPLAY: Record<TransportMode, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  flight: { label: 'Volo', icon: 'airplane' },
  train: { label: 'Treno', icon: 'train' },
  car: { label: 'Auto', icon: 'car' },
  bus: { label: 'Bus', icon: 'bus' },
  ferry: { label: 'Traghetto', icon: 'boat' },
  other: { label: 'Altro', icon: 'ellipsis-horizontal-circle' },
};

export function getTransportModeMeta(mode: TransportMode): { label: string; icon: keyof typeof Ionicons.glyphMap } {
  return TRANSPORT_MODE_DISPLAY[mode];
}

/** Forma {value,label} per `ChipSelector`, derivata da `TRANSPORT_MODE_OPTIONS`. */
export const TRANSPORT_MODE_CHIP_OPTIONS = TRANSPORT_MODE_OPTIONS.map((o) => ({ value: o.mode, label: o.label }));
