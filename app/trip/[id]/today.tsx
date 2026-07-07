import React from 'react';
import { View, Pressable, StatusBar, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../src/shared/components/Typography';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { useNextPlace, useTravelActions } from '../../../src/shared/hooks';
import { formatDistance } from '../../../src/shared/utils/distance.utils';

/**
 * ============================================================================
 * TODAY SCREEN (DASHBOARD IN VIAGGIO / JOURNEY)
 * ============================================================================
 * Conforme alla Regola d'Oro: legge e modifica lo stato in tempo reale
 * unicamente tramite useNextPlace(tripId) e useTravelActions().
 */
export default function TodayScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ id: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ id: string | string[] }>();
  const idParam = localParams.id || globalParams.id;
  const tripId = (Array.isArray(idParam) ? idParam[0] : idParam) || 'trip-budapest-2026';

  const { currentOrNextPlace, upcomingPlacesToday, timeAvailableMinutesToday } = useNextPlace(tripId);
  const actions = useTravelActions();

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]">
      <StatusBar barStyle="dark-content" />
      
      {/* Header Comune */}
      <View className="px-5 py-2 flex-row items-center justify-between border-b border-gray-100 pb-4">
        <Pressable onPress={() => router.back()} className="flex-row items-center">
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
          <Typography variant="bodySemibold" className="text-gray-900 ml-1">Dashboard</Typography>
        </Pressable>
        <View className="flex-row items-center bg-green-100 px-3 py-1 rounded-full">
          <View className="w-2 h-2 rounded-full bg-green-600 mr-1.5" />
          <Typography variant="captionSemibold" className="text-green-800">In Viaggio</Typography>
        </View>
      </View>

      <View className="px-5 pt-4 pb-6 border-b border-gray-100 bg-white">
        <Typography variant="h2" className="text-gray-900">Today</Typography>
        <Typography variant="body" className="text-gray-500 mt-1">
          Tempo libero stimato oggi: {timeAvailableMinutesToday} min
        </Typography>
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        {/* Prossima Tappa / Tappa Corrente */}
        <Typography variant="h3" className="mb-3">Prossima Tappa in Programma</Typography>
        
        {!currentOrNextPlace ? (
          <EmptyState
            icon="checkmark-done-circle-outline"
            title="Giornata completata!"
            description="Hai completato tutte le tappe previste per oggi o non ci sono luoghi assegnati alla giornata odierna."
            actionLabel="Esplora Libreria"
            onAction={() => router.push(`/trip/${tripId}/places` as any)}
          />
        ) : (
          <View className="bg-white rounded-3xl overflow-hidden shadow-md border border-gray-100 mb-8">
            <ImageBackground
              source={{ uri: currentOrNextPlace.coverImageUrl || 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?q=80&w=800&auto=format&fit=crop' }}
              className="h-48 w-full justify-end"
            >
              <View className="absolute inset-0 bg-black/20" />
              <View className="absolute bottom-0 left-0 right-0 h-28 bg-gradient-to-t from-black/80 to-transparent" />
              
              <View className="p-4 relative z-10 flex-row justify-between items-end">
                <View className="flex-1 mr-2">
                  <View className="flex-row items-center mb-1">
                    <Ionicons name="location" size={14} color="#38BDF8" />
                    <Typography variant="captionMedium" color="inverse" className="text-sky-300 ml-1">
                      {(currentOrNextPlace.estimatedWalkMinutes && currentOrNextPlace.estimatedWalkMinutes > 0) 
                        ? `Tra ${currentOrNextPlace.estimatedWalkMinutes} min a piedi (${formatDistance(currentOrNextPlace.distanceMeters || 0)})` 
                        : '📍 Punto di partenza della giornata (Tappa attuale)'}
                    </Typography>
                  </View>
                  <Typography variant="h2" color="inverse" className="text-white text-2xl font-bold" numberOfLines={1}>
                    {currentOrNextPlace.name}
                  </Typography>
                </View>
                {currentOrNextPlace.priority === 'must_see' && (
                  <View className="px-2.5 py-1 bg-amber-400 rounded-full">
                    <Typography variant="captionSemibold" className="text-gray-900 text-xs">⭐ Must See</Typography>
                  </View>
                )}
              </View>
            </ImageBackground>

            <View className="p-5">
              <View className="flex-row items-center justify-between mb-4">
                <Typography variant="captionMedium" className="text-gray-500 capitalize">
                  Categoria: {currentOrNextPlace.category}
                </Typography>
                <Typography variant="captionMedium" className="text-gray-500">
                  Durata: {currentOrNextPlace.durationMinutes || 60} min
                </Typography>
              </View>

              {currentOrNextPlace.notes ? (
                <View className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-5">
                  <Typography variant="caption" className="text-gray-600 italic font-serif">
                    "{currentOrNextPlace.notes}"
                  </Typography>
                </View>
              ) : null}

              {/* Azioni Rapide */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => router.push(`/trip/${tripId}/places/${currentOrNextPlace.id}` as any)}
                  className="flex-1 bg-gray-100 rounded-xl py-3.5 items-center justify-center active:bg-gray-200"
                >
                  <Typography variant="bodySemibold" className="text-gray-900">Dettaglio</Typography>
                </Pressable>

                <Pressable
                  onPress={() => actions.markAsVisited(tripId, currentOrNextPlace.id)}
                  className="flex-[2] bg-green-600 rounded-xl py-3.5 items-center justify-center flex-row active:bg-green-700 shadow-sm"
                >
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" className="mr-1.5" />
                  <Typography variant="bodySemibold" className="text-white">Check-in / Visitato</Typography>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* Successive tappe oggi */}
        {upcomingPlacesToday && upcomingPlacesToday.length > 0 && (
          <View className="mb-8">
            <Typography variant="h3" className="mb-3">Successive tappe oggi ({upcomingPlacesToday.length})</Typography>
            <View className="space-y-3">
              {upcomingPlacesToday.map((place, index) => (
                <Pressable
                  key={place.id}
                  onPress={() => router.push(`/trip/${tripId}/places/${place.id}` as any)}
                  className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex-row items-center justify-between active:bg-gray-50"
                >
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center">
                      <View className="w-6 h-6 rounded-full bg-gray-100 items-center justify-center mr-2.5">
                        <Typography variant="captionSemibold" className="text-gray-700">{index + 2}</Typography>
                      </View>
                      <Typography variant="bodySemibold" className="text-gray-900 flex-1" numberOfLines={1}>
                        {place.name}
                      </Typography>
                    </View>
                    <Typography variant="caption" className="text-gray-500 ml-8.5 mt-1 capitalize">
                      {place.category} • {place.durationMinutes || 60} min
                    </Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <View className="h-16" />
      </ScrollView>
    </SafeAreaView>
  );
}
