import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutLeft, LinearTransition } from 'react-native-reanimated';
import { Typography } from '../../../../src/shared/components/Typography';
import { EmptyState } from '../../../../src/shared/components/EmptyState';
import { useAccommodations, useTravelActions } from '../../../../src/shared/hooks';
import { hydrateContext } from '../../../../src/core/engines';
import { AccommodationCard } from '../../../../src/features/trips/accommodation/components/AccommodationCard';

/**
 * ============================================================================
 * ACCOMMODATION LIST SCREEN (Accommodation Setup module)
 * ============================================================================
 * Conforme alla Regola d'Oro: legge esclusivamente tramite
 * useAccommodations(tripId) e scrive esclusivamente tramite
 * useTravelActions() — nessun import diretto di TripSetupEngine/MMKV.
 * Stessa struttura di `transport/index.tsx`.
 */
export default function AccommodationListScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = Array.isArray(id) ? id[0] : id;

  const { accommodations } = useAccommodations(tripId);
  const actions = useTravelActions();
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    hydrateContext(tripId).then(() => setIsHydrating(false));
  }, [tripId]);

  const handleDelete = (accommodationId: string, label: string) => {
    Alert.alert(
      'Elimina alloggio',
      `Sei sicuro di voler eliminare "${label}"?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: () => {
            actions.removeAccommodation(tripId, accommodationId).catch((e) => {
              Alert.alert('Errore', e?.message || "Impossibile eliminare l'alloggio.");
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
          onPress={() => router.push(`/trip/${tripId}/accommodation/new` as any)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Aggiungi alloggio"
          className="w-9 h-9 rounded-full bg-gray-900 items-center justify-center"
        >
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </Pressable>
      </View>

      <View className="px-5 pt-4 pb-6 border-b border-border-light">
        <Typography variant="h2">Alloggi</Typography>
        <Typography variant="body" color="secondary" className="mt-1">
          Hotel, appartamenti e altre sistemazioni per questo viaggio
        </Typography>
      </View>

      {isHydrating ? null : accommodations.length === 0 ? (
        <EmptyState
          icon="bed-outline"
          title="Nessun alloggio"
          description="Aggiungi hotel, Airbnb o altre sistemazioni per tenere traccia di dove dormirai."
          actionLabel="Aggiungi alloggio"
          onAction={() => router.push(`/trip/${tripId}/accommodation/new` as any)}
        />
      ) : (
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {accommodations.map((accommodation, index) => (
            <Animated.View
              key={accommodation.id}
              entering={FadeInDown.delay(index * 40).duration(250)}
              exiting={FadeOutLeft.duration(200)}
              layout={LinearTransition}
            >
              <AccommodationCard
                accommodation={accommodation}
                onPress={() => router.push(`/trip/${tripId}/accommodation/${accommodation.id}` as any)}
                onDelete={() => handleDelete(accommodation.id, accommodation.name)}
              />
            </Animated.View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
