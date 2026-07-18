import React, { useState } from 'react';
import { View, ScrollView, Pressable, Alert } from 'react-native';
import { Typography } from '../../../../shared/components/Typography';
import { Button } from '../../../../shared/components/Button';
import { TextField } from '../../../../shared/components/forms/TextField';
import { DateTimeField } from '../../../../shared/components/forms/DateTimeField';
import { ChipSelector } from '../../../../shared/components/forms/ChipSelector';
import { Accommodation, AccommodationType } from '../../../../domain/trip/models/trip-setup.model';
import { unsafeAsInstantISO } from '../../../../domain/time';
import { validateAccommodationForm } from '../../../../domain/trip/validators/accommodation.validator';
import { ACCOMMODATION_TYPE_CHIP_OPTIONS } from '../accommodation-type.constants';

export interface AccommodationFormProps {
  initial?: Accommodation;
  isSaving?: boolean;
  onSave: (data: Omit<Accommodation, 'id'>) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  tripStartDate?: Date;
  tripEndDate?: Date;
}

function buildDefaultCheckIn(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  d.setHours(15, 0, 0, 0); // orario di check-in tipico
  return d;
}

function buildDefaultCheckOut(checkIn: Date): Date {
  const d = new Date(checkIn);
  d.setDate(d.getDate() + 3);
  d.setHours(11, 0, 0, 0); // orario di check-out tipico
  return d;
}

/**
 * Form condiviso di aggiunta/modifica alloggio — usato sia da
 * `app/trip/[id]/accommodation/new.tsx` sia da
 * `app/trip/[id]/accommodation/[accommodationId].tsx`. Stessa struttura di
 * `TransportForm`: nessuna logica di business qui, la validazione delega a
 * `validateAccommodationForm` (dominio, pura) e il salvataggio al chiamante
 * via `onSave` (che passa da `useTravelActions`, mai da un engine importato
 * direttamente).
 */
export const AccommodationForm: React.FC<AccommodationFormProps> = ({
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
  const defaultCheckIn = initial?.checkIn ? new Date(initial.checkIn) : (tripStartDate ? (() => {
    const d = new Date(tripStartDate);
    d.setHours(15, 0, 0, 0);
    return d;
  })() : buildDefaultCheckIn());

  const defaultCheckOut = initial?.checkOut ? new Date(initial.checkOut) : (tripEndDate ? (() => {
    const d = new Date(tripEndDate);
    d.setHours(11, 0, 0, 0);
    return d;
  })() : buildDefaultCheckOut(defaultCheckIn));

  const [type, setType] = useState<AccommodationType | ''>(initial?.type ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [checkIn, setCheckIn] = useState<Date>(defaultCheckIn);
  const [checkOut, setCheckOut] = useState<Date>(defaultCheckOut);
  const [bookingReference, setBookingReference] = useState(initial?.bookingReference ?? '');
  const [confirmationUrl, setConfirmationUrl] = useState(initial?.confirmationUrl ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleCheckInChange = (date: Date) => {
    setCheckIn(date);
    // Se il check-out precede il nuovo check-in, lo spostiamo in avanti
    // automaticamente (comodità del form, non un invariante di dominio).
    if (checkOut <= date) {
      setCheckOut(buildDefaultCheckOut(date));
    }
  };

  const handleSubmit = () => {
    const result = validateAccommodationForm({
      type,
      name,
      address,
      checkIn,
      checkOut,
      bookingReference,
      confirmationUrl,
      notes,
    });

    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setErrors({});

    onSave({
      type: type as AccommodationType,
      name: name.trim(),
      address: address.trim() || undefined,
      checkIn: unsafeAsInstantISO(checkIn.toISOString()),
      checkOut: unsafeAsInstantISO(checkOut.toISOString()),
      bookingReference: bookingReference.trim() || undefined,
      confirmationUrl: confirmationUrl.trim() || undefined,
      notes: notes.trim() || undefined,
      confirmed: initial?.confirmed ?? false,
      cost: initial?.cost,
      currency: initial?.currency,
      coordinates: initial?.coordinates,
    });
  };

  const handleDeletePress = () => {
    if (!onDelete) return;
    Alert.alert(
      'Elimina alloggio',
      'Sei sicuro di voler eliminare questo alloggio?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: () => onDelete() },
      ]
    );
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Tipologia */}
        <View className="mb-5">
          <Typography variant="captionSemibold" className="text-gray-500 mb-3 uppercase tracking-wider">
            Tipologia *
          </Typography>
          <ChipSelector
            options={ACCOMMODATION_TYPE_CHIP_OPTIONS}
            value={type}
            onChange={setType}
            accessibilityLabel="Tipologia di alloggio"
          />
          {errors.type ? (
            <Typography variant="caption" className="text-red-500 mt-1.5 ml-1 font-medium">{errors.type}</Typography>
          ) : null}
        </View>

        <TextField
          label="Nome alloggio *"
          value={name}
          onChangeText={setName}
          placeholder="es. Hotel Danubio"
          error={errors.name}
        />

        <TextField
          label="Indirizzo *"
          value={address}
          onChangeText={setAddress}
          placeholder="es. Via del Danubio 12, Budapest"
          error={errors.address}
        />

        <DateTimeField label="Check-in *" value={checkIn} onChange={handleCheckInChange} error={errors.checkIn} />
        <DateTimeField
          label="Check-out *"
          value={checkOut}
          onChange={setCheckOut}
          minimumDate={checkIn}
          error={errors.checkOut}
        />

        <TextField
          label="Numero di prenotazione"
          value={bookingReference}
          onChangeText={setBookingReference}
          placeholder="es. RES-987 (facoltativo)"
        />

        <TextField
          label="Link di conferma"
          value={confirmationUrl}
          onChangeText={setConfirmationUrl}
          placeholder="https://... (facoltativo)"
          keyboardType="url"
          autoCapitalize="none"
          error={errors.confirmationUrl}
        />

        <TextField
          label="Note"
          value={notes}
          onChangeText={setNotes}
          placeholder="Note facoltative (es. chiedere piano alto)"
          multiline
        />

        {onDelete ? (
          <Pressable onPress={handleDeletePress} className="flex-row items-center justify-center py-3 mb-4">
            <Typography variant="bodySemibold" className="text-red-600">Elimina alloggio</Typography>
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
