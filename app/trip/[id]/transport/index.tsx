import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { Typography } from '../../../../src/shared/components/Typography';
import { EmptyState } from '../../../../src/shared/components/EmptyState';
import { useTransports, useTravelActions } from '../../../../src/shared/hooks';
import { hydrateContext } from '../../../../src/core/engines';
import { TransportCard } from '../../../../src/features/trips/transport/components/TransportCard';

/**
 * ============================================================================
 * TRANSPORT LIST SCREEN (Transport Setup module)
 * ============================================================================
 * Conforme alla Regola d'Oro: legge esclusivamente tramite useTransports(tripId)
 * e scrive esclusivamente tramite useTravelActions() — nessun import diretto
 * di TripSetupEngine/MMKV in questa schermata.
 */
export default function TransportListScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Array.isArray(id) ? id[0] : id;

  const { transports } = useTransports(tripId);
  const actions = useTravelActions();
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    hydrateContext(tripId).then(() => setIsHydrating(false));
  }, [tripId]);

  const handleDelete = (transportId: string, label: string) => {
    Alert.alert(
      'Elimina trasporto',
      `Sei sicuro di voler eliminare "${label}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            actions.removeTransport(tripId, transportId).catch((e) => {
              Alert.alert('Errore', e?.message || "Impossibile eliminare il trasporto.");
            });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />

      {/* Header comune */}
      <View className="px-5 py-2 flex-row items-center justify-between border-b border-border-light pb-4">
        <Pressable onPress={() => router.back()} className="flex-row items-center" accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
          <Typography variant="bodySemibold" color="accent" className="ml-1">Dashboard</Typography>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/trip/${tripId}/transport/new` as any)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Aggiungi trasporto"
          className="w-9 h-9 rounded-full bg-gray-900 items-center justify-center"
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="px-5 pt-4 pb-6 border-b border-border-light">
        <Typography variant="h2">Trasporti</Typography>
        <Typography variant="body" color="secondary" className="mt-1">
          Voli, treni e altri spostamenti per questo viaggio
        </Typography>
      </View>

      {isHydrating ? null : transports.length === 0 ? (
        <EmptyState
          icon="airplane-outline"
          title="Nessun trasporto"
          description="Aggiungi voli, treni o altri spostamenti per tenere traccia di come arrivi e ripartirai."
          actionLabel="Aggiungi trasporto"
          onAction={() => router.push(`/trip/${tripId}/transport/new` as any)}
        />
      ) : (
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {transports.map((transport, index) => (
            <Animated.View
              key={transport.id}
              entering={FadeInDown.delay(index * 40).duration(250)}
              exiting={FadeOutLeft.duration(200)}
              layout={LinearTransition}
            >
              <TransportCard
                transport={transport}
                onPress={() => router.push(`/trip/${tripId}/transport/${transport.id}` as any)}
                onDelete={() => handleDelete(transport.id, `${transport.origin || '—'} → ${transport.destination}`)}
              />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
