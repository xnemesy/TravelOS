import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FormScreenHeader } from '../../../../src/shared/components/FormScreenHeader';
import { ErrorBanner } from '../../../../src/shared/components/ErrorBanner';
import { useTravelActions, useTravelContext } from '../../../../src/shared/hooks';
import { AccommodationForm } from '../../../../src/features/trips/accommodation/components/AccommodationForm';
import { Accommodation } from '../../../../src/domain/trip/models/trip-setup.model';

export default function AddAccommodationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Array.isArray(id) ? id[0] : id;
  const actions = useTravelActions();
  const context = useTravelContext(tripId);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const tripStartDate = context?.startDate ? new Date(context.startDate) : undefined;
  const tripEndDate = context?.endDate ? new Date(context.endDate) : undefined;

  const handleSave = async (data: Omit<Accommodation, 'id'>) => {
    setIsSaving(true);
    setSaveError('');
    try {
      await actions.addAccommodation(tripId, data);
      router.back();
    } catch (e: any) {
      setSaveError(e?.message || "Errore durante il salvataggio dell'alloggio.");
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <FormScreenHeader title="Nuovo alloggio" onLeftPress={() => router.back()} />

      {saveError ? <ErrorBanner message={saveError} /> : null}

      <AccommodationForm
        isSaving={isSaving}
        onSave={handleSave}
        tripStartDate={tripStartDate}
        tripEndDate={tripEndDate}
      />
    </SafeAreaView>
  );
}
