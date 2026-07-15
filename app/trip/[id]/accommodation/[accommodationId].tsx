import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { EmptyState } from '../../../../src/shared/components/EmptyState';
import { FormScreenHeader } from '../../../../src/shared/components/FormScreenHeader';
import { ErrorBanner } from '../../../../src/shared/components/ErrorBanner';
import { useAccommodations, useTravelActions } from '../../../../src/shared/hooks';
import { AccommodationForm } from '../../../../src/features/trips/accommodation/components/AccommodationForm';
import { Accommodation } from '../../../../src/domain/trip/models/trip-setup.model';

/**
 * Modifica alloggio — legge esclusivamente da useAccommodations(tripId),
 * stessa struttura di `transport/[transportId].tsx`. Nessun fallback su
 * repository/provider: un alloggio esiste solo se già salvato.
 */
export default function EditAccommodationScreen() {
  const router = useRouter();
  const { id, accommodationId } = useLocalSearchParams<{ id: string; accommodationId: string }>();
  const tripId = Array.isArray(id) ? id[0] : id;
  const cleanAccommodationId = Array.isArray(accommodationId) ? accommodationId[0] : accommodationId;

  const { accommodations } = useAccommodations(tripId);
  const actions = useTravelActions();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const accommodation = accommodations.find((a) => a.id === cleanAccommodationId);

  const handleSave = async (data: Omit<Accommodation, 'id'>) => {
    setIsSaving(true);
    setSaveError('');
    try {
      await actions.updateAccommodation(tripId, cleanAccommodationId, data);
      router.back();
    } catch (e: any) {
      setSaveError(e?.message || "Errore durante il salvataggio dell'alloggio.");
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await actions.removeAccommodation(tripId, cleanAccommodationId);
      router.back();
    } catch (e: any) {
      setSaveError(e?.message || "Errore durante l'eliminazione dell'alloggio.");
    }
  };

  if (!accommodation) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <StatusBar barStyle="dark-content" />
        <FormScreenHeader onLeftPress={() => router.back()} leftLabel="Indietro" />
        <EmptyState
          icon="alert-circle-outline"
          title="Alloggio non trovato"
          description="Questo alloggio potrebbe essere già stato eliminato."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <FormScreenHeader title="Modifica alloggio" onLeftPress={() => router.back()} />

      {saveError ? <ErrorBanner message={saveError} /> : null}

      <AccommodationForm initial={accommodation} isSaving={isSaving} onSave={handleSave} onDelete={handleDelete} />
    </SafeAreaView>
  );
}
