import React, { useState } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { Typography } from '../../../../shared/components/Typography';
import { Button } from '../../../../shared/components/Button';
import { TextField } from '../../../../shared/components/forms/TextField';
import { DateTimeField } from '../../../../shared/components/forms/DateTimeField';
import { ChipSelector } from '../../../../shared/components/forms/ChipSelector';
import { Transport, TransportMode } from '../../../../domain/trip/models/trip-setup.model';
import { unsafeAsInstantISO } from '../../../../domain/time';
import { validateTransportForm } from '../../../../domain/trip/validators/transport.validator';
import { TRANSPORT_MODE_CHIP_OPTIONS } from '../transport-mode.constants';

export interface TransportFormProps {
  initial?: Transport;
  isSaving?: boolean;
  onSave: (data: Omit<Transport, 'id'>) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  tripStartDate?: Date;
  tripEndDate?: Date;
}

function buildDefaultDepartureDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(9, 0, 0, 0);
  return d;
}

function buildDefaultArrivalDate(departure: Date): Date {
  const d = new Date(departure);
  d.setHours(d.getHours() + 2);
  return d;
}

/**
 * Form condiviso di aggiunta/modifica trasporto — usato sia da
 * `app/trip/[id]/transport/new.tsx` sia da `app/trip/[id]/transport/[transportId].tsx`.
 * Nessuna logica di business qui: la validazione delega interamente a
 * `validateTransportForm` (dominio, pura); il salvataggio delega al
 * chiamante via `onSave` (che a sua volta passa da `useTravelActions`, mai
 * da un engine importato direttamente in questo componente).
 */
export const TransportForm: React.FC<TransportFormProps> = ({
  initial,
  isSaving = false,
  onSave,
  onDelete,
  tripStartDate,
  tripEndDate,
}) => {
  // initial.* è un InstantISO (stringa) dopo ADR-025 §7 n; lo stato del form
  // resta `Date` per i DateTimeField. Conversione al confine, nessun cambio di
  // comportamento (il formato serializzato coincide con `Date.toISOString()`).
  const defaultDeparture = initial?.departureDate ? new Date(initial.departureDate) : (tripStartDate ? (() => {
    const d = new Date(tripStartDate);
    d.setHours(9, 0, 0, 0);
    return d;
  })() : buildDefaultDepartureDate());

  const defaultArrival = initial?.arrivalDate ? new Date(initial.arrivalDate) : buildDefaultArrivalDate(defaultDeparture);

  const [mode, setMode] = useState<TransportMode | ''>(initial?.mode ?? '');
  const [origin, setOrigin] = useState(initial?.origin ?? '');
  const [destination, setDestination] = useState(initial?.destination ?? '');
  const [departureDate, setDepartureDate] = useState<Date>(defaultDeparture);
  const [arrivalDate, setArrivalDate] = useState<Date>(defaultArrival);
  const [bookingReference, setBookingReference] = useState(initial?.bookingReference ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDepartureChange = (date: Date) => {
    setDepartureDate(date);
    // Se l'arrivo precede la nuova partenza, lo spostiamo in avanti automaticamente
    // (comodità del form, non un invariante di dominio — l'utente può comunque correggerlo).
    if (arrivalDate < date) {
      setArrivalDate(buildDefaultArrivalDate(date));
    }
  };

  const handleSubmit = () => {
    const result = validateTransportForm({
      mode,
      origin,
      destination,
      departureDate,
      arrivalDate,
      bookingReference,
      notes,
    });

    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    onSave({
      mode: mode as TransportMode,
      origin: origin.trim(),
      destination: destination.trim(),
      departureDate: unsafeAsInstantISO(departureDate.toISOString()),
      arrivalDate: unsafeAsInstantISO(arrivalDate.toISOString()),
      bookingReference: bookingReference.trim() || undefined,
      notes: notes.trim() || undefined,
      confirmed: initial?.confirmed ?? false,
      cost: initial?.cost,
      currency: initial?.currency,
      sequenceOrder: initial?.sequenceOrder,
    });
  };

  const handleDeletePress = () => {
    if (!onDelete) return;
    Alert.alert(
      'Elimina trasporto',
      'Sei sicuro di voler eliminare questa tratta di trasporto?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: () => onDelete() },
      ]
    );
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Mezzo di trasporto */}
        <View className="mb-5">
          <Typography variant="captionSemibold" className="text-gray-500 mb-3 uppercase tracking-wider">
            Mezzo di trasporto *
          </Typography>
          <ChipSelector
            options={TRANSPORT_MODE_CHIP_OPTIONS}
            value={mode}
            onChange={setMode}
            accessibilityLabel="Mezzo di trasporto"
          />
          {errors.mode ? (
            <Typography variant="caption" className="text-red-500 mt-1.5 ml-1 font-medium">{errors.mode}</Typography>
          ) : null}
        </View>

        <TextField
          label="Partenza da *"
          value={origin}
          onChangeText={setOrigin}
          placeholder="es. Milano Malpensa"
          error={errors.origin}
        />

        <TextField
          label="Arrivo a *"
          value={destination}
          onChangeText={setDestination}
          placeholder="es. Budapest"
          error={errors.destination}
        />

        <DateTimeField label="Data e ora di partenza *" value={departureDate} onChange={handleDepartureChange} error={errors.departureDate} />
        <DateTimeField
          label="Data e ora di arrivo *"
          value={arrivalDate}
          onChange={setArrivalDate}
          minimumDate={departureDate}
          error={errors.arrivalDate}
        />

        <TextField
          label="Codice di prenotazione"
          value={bookingReference}
          onChangeText={setBookingReference}
          placeholder="es. ABC123 (facoltativo)"
        />

        <TextField
          label="Note"
          value={notes}
          onChangeText={setNotes}
          placeholder="Note facoltative (es. check-in già fatto)"
          multiline
        />

        {onDelete ? (
          <Pressable onPress={handleDeletePress} className="flex-row items-center justify-center py-3 mb-4">
            <Typography variant="bodySemibold" className="text-red-600">Elimina trasporto</Typography>
          </Pressable>
        ) : null}
      </ScrollView>

      <View className="px-5 pb-8 pt-3 border-t border-gray-100">
        <Button
          label={isSaving ? 'Salvataggio...' : 'Salva'}
          onPress={handleSubmit}
          disabled={isSaving}
          variant="solid"
          size="lg"
          fullWidth
        />
      </View>
    </View>
  );
};
