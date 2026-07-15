import React, { useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { EmptyState } from '../../../../src/shared/components/EmptyState';
import { FormScreenHeader } from '../../../../src/shared/components/FormScreenHeader';
import { ErrorBanner } from '../../../../src/shared/components/ErrorBanner';
import { useTransports, useTravelActions } from '../../../../src/shared/hooks';
import { TransportForm } from '../../../../src/features/trips/transport/components/TransportForm';
import { Transport } from '../../../../src/domain/trip/models/trip-setup.model';

/**
 * Modifica trasporto — legge esclusivamente da useTransports(tripId), a
 * differenza di `places/[placeId].tsx` non c'è bisogno di alcun fallback su
 * repository/provider (nessun caso "trasporto non ancora salvato" da
 * gestire: un trasporto esiste solo se è già stato salvato).
 */
export default function EditTransportScreen() {
  const router = useRouter();
  const { id, transportId } = useLocalSearchParams<{ id: string; transportId: string }>();
  const tripId = Array.isArray(id) ? id[0] : id;
  const cleanTransportId = Array.isArray(transportId) ? transportId[0] : transportId;

  const { transports } = useTransports(tripId);
  const actions = useTravelActions();
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const transport = transports.find((t) => t.id === cleanTransportId);

  const handleSave = async (data: Omit<Transport, 'id'>) => {
    setIsSaving(true);
    setSaveError('');
    try {
      await actions.updateTransport(tripId, cleanTransportId, data);
      router.back();
    } catch (e: any) {
      setSaveError(e?.message || 'Errore durante il salvataggio del trasporto.');
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await actions.removeTransport(tripId, cleanTransportId);
      router.back();
    } catch (e: any) {
      setSaveError(e?.message || "Errore durante l'eliminazione del trasporto.");
    }
  };

  if (!transport) {
    return (
      <SafeAreaView className="flex-1 bg-white">
        <StatusBar barStyle="dark-content" />
        <FormScreenHeader onLeftPress={() => router.back()} leftLabel="Indietro" />
        <EmptyState
          icon="alert-circle-outline"
          title="Trasporto non trovato"
          description="Questo trasporto potrebbe essere già stato eliminato."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <FormScreenHeader title="Modifica trasporto" onLeftPress={() => router.back()} />

      {saveError ? <ErrorBanner message={saveError} /> : null}

      <TransportForm initial={transport} isSaving={isSaving} onSave={handleSave} onDelete={handleDelete} />
    </SafeAreaView>
  );
}
