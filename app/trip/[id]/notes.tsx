import React from 'react';
import { View, Pressable, StatusBar, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../src/shared/components/Typography';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { usePlaces, useTravelContext } from '../../../src/shared/hooks';

/**
 * ============================================================================
 * NOTES & DIARY SCREEN (DIARIO E APPUNTI DI VIAGGIO)
 * ============================================================================
 * Conforme alla Regola d'Oro: legge e aggrega gli appunti e le visite
 * reattivamente tramite usePlaces(tripId) e useTravelContext(tripId).
 */
export default function NotesScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ id: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ id: string | string[] }>();
  const idParam = localParams.id || globalParams.id;
  const tripId = (Array.isArray(idParam) ? idParam[0] : idParam) || 'trip-budapest-2026';

  const context = useTravelContext(tripId);
  const { savedPlaces, visitedPlaces } = usePlaces(tripId);

  // Filtra i luoghi che hanno note personali o che sono stati visitati
  const placesWithNotes = savedPlaces.filter((p) => p.notes && p.notes.trim().length > 0);

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]">
      <StatusBar barStyle="dark-content" />
      
      {/* Header Comune */}
      <View className="px-5 py-2 flex-row items-center justify-between border-b border-gray-100 pb-4">
        <Pressable onPress={() => router.back()} className="flex-row items-center">
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
          <Typography variant="bodySemibold" className="text-gray-900 ml-1">Dashboard</Typography>
        </Pressable>
        <View className="flex-row items-center bg-amber-100 px-3 py-1 rounded-full">
          <Ionicons name="book" size={14} color="#92400E" className="mr-1" />
          <Typography variant="captionSemibold" className="text-amber-800">Diario</Typography>
        </View>
      </View>

      <View className="px-5 pt-4 pb-6 border-b border-gray-100 bg-white">
        <Typography variant="h2" className="text-gray-900">Diario & Appunti</Typography>
        <Typography variant="body" className="text-gray-500 mt-1">
          {visitedPlaces.length} tappe visitate • {placesWithNotes.length} note personali
        </Typography>
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        {/* Sezione Tappe Visitate (Diario di Bordo) */}
        {visitedPlaces.length > 0 && (
          <View className="mb-8">
            <Typography variant="h3" className="mb-3">Tappe Completate</Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              {visitedPlaces.map((place) => (
                <Pressable
                  key={place.id}
                  onPress={() => router.push(`/trip/${tripId}/places/${place.id}` as any)}
                  className="w-56 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm mx-1 active:opacity-80"
                >
                  <ImageBackground
                    source={{ uri: place.coverImageUrl || 'https://images.unsplash.com/photo-1514896856000-91cb6de818e0?q=80&w=400&auto=format&fit=crop' }}
                    className="h-28 w-full justify-end"
                  >
                    <View className="absolute inset-0 bg-black/20" />
                    <View className="p-3 bg-gradient-to-t from-black/80 to-transparent">
                      <View className="flex-row items-center">
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                        <Typography variant="captionSemibold" className="text-white ml-1 text-xs">Visitato</Typography>
                      </View>
                    </View>
                  </ImageBackground>
                  <View className="p-3">
                    <Typography variant="bodySemibold" className="text-gray-900 leading-tight" numberOfLines={1}>
                      {place.name}
                    </Typography>
                    <Typography variant="caption" className="text-gray-500 capitalize mt-0.5">
                      {place.category}
                    </Typography>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Sezione Appunti Personali */}
        <Typography variant="h3" className="mb-3">Note Personali</Typography>
        
        {placesWithNotes.length === 0 ? (
          <EmptyState
            icon="create-outline"
            title="Nessun appunto nel diario"
            description="Aggiungi note personali alle schede dei tuoi luoghi per ritrovarle qui aggregate in tempo reale."
            actionLabel="Esplora Catalogo"
            onAction={() => router.push(`/trip/${tripId}/places` as any)}
          />
        ) : (
          <View className="space-y-4 mb-8">
            {placesWithNotes.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => router.push(`/trip/${tripId}/places/${place.id}` as any)}
                className="bg-[#fcfbf9] border border-[#e8e6df] rounded-2xl p-5 shadow-sm active:bg-[#f5f3eb]"
              >
                <View className="flex-row items-center justify-between mb-2 pb-2 border-b border-gray-200/50">
                  <View className="flex-row items-center">
                    <Ionicons name="location-outline" size={16} color="#4B5563" />
                    <Typography variant="bodySemibold" className="text-gray-900 ml-1.5 text-base">
                      {place.name}
                    </Typography>
                  </View>
                  <Typography variant="caption" className="text-gray-400 capitalize">
                    {place.category}
                  </Typography>
                </View>

                <Typography variant="body" className="text-gray-800 font-serif text-[16px] leading-relaxed italic">
                  "{place.notes}"
                </Typography>
              </Pressable>
            ))}
          </View>
        )}

        <View className="h-16" />
      </ScrollView>
    </SafeAreaView>
  );
}
