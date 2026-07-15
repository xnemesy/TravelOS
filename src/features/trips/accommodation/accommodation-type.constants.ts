import { Ionicons } from '@expo/vector-icons';
import { AccommodationType } from '../../../domain/trip/models/trip-setup.model';

export interface AccommodationTypeMeta {
  type: AccommodationType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/**
 * Le 5 tipologie di alloggio selezionabili in questo modulo, come richiesto:
 * Hotel/Airbnb/Apartment/Hostel/Other. Coincide 1:1 con `AccommodationTypeSchema`
 * (nessun valore extra da nascondere qui, a differenza del Transport Setup
 * module dove il dominio ha un valore — `ferry` — non offerto in questo form).
 */
export const ACCOMMODATION_TYPE_OPTIONS: AccommodationTypeMeta[] = [
  { type: 'hotel', label: 'Hotel', icon: 'business' },
  { type: 'airbnb', label: 'Airbnb', icon: 'home' },
  { type: 'apartment', label: 'Appartamento', icon: 'key' },
  { type: 'hostel', label: 'Ostello', icon: 'bed' },
  { type: 'other', label: 'Altro', icon: 'ellipsis-horizontal-circle' },
];

// ACCOMMODATION_TYPE_OPTIONS copre l'intero enum di dominio 1:1 (a differenza
// di TRANSPORT_MODE_OPTIONS, che ne omette un valore) — derivare la mappa di
// visualizzazione da qui evita di duplicare label/icona una seconda volta.
const ACCOMMODATION_TYPE_DISPLAY = ACCOMMODATION_TYPE_OPTIONS.reduce<
  Record<AccommodationType, { label: string; icon: keyof typeof Ionicons.glyphMap }>
>((acc, o) => {
  acc[o.type] = { label: o.label, icon: o.icon };
  return acc;
}, {} as Record<AccommodationType, { label: string; icon: keyof typeof Ionicons.glyphMap }>);

export function getAccommodationTypeMeta(type: AccommodationType): { label: string; icon: keyof typeof Ionicons.glyphMap } {
  return ACCOMMODATION_TYPE_DISPLAY[type];
}

/** Forma {value,label} per `ChipSelector`, derivata da `ACCOMMODATION_TYPE_OPTIONS`. */
export const ACCOMMODATION_TYPE_CHIP_OPTIONS = ACCOMMODATION_TYPE_OPTIONS.map((o) => ({ value: o.type, label: o.label }));
