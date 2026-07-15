import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../../src/shared/components/Typography';
import { usePlaces, useTravelActions, useTimeline } from '../../../../src/shared/hooks';
import { useToastStore } from '../../../../src/shared/store/useToastStore';
import * as Haptics from 'expo-haptics';

interface SavedPlacesLibraryProps {
  tripId: string;
}

/**
 * ============================================================================
 * SAVED PLACES LIBRARY (LIBRERIA LUOGHI SALVATI)
 * ============================================================================
 * Mostra tutti i luoghi salvati nel viaggio (sia pianificati che da pianificare)
 * offrendo controlli rapidi per pianificarli, spostarli o eliminarli.
 */
export const SavedPlacesLibrary: React.FC<SavedPlacesLibraryProps> = ({ tripId }) => {
  const router = useRouter();
  const { savedPlaces } = usePlaces(tripId);
  const { days } = useTimeline(tripId);
  const actions = useTravelActions();
  const { success } = useToastStore();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  const toggleSelection = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatchAssign = async (dayNumber: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    for (const placeId of selectedIds) {
      const place = savedPlaces.find(p => p.id === placeId);
      if (place) {
        await actions.assignPlaceToDay(tripId, dayNumber, {
          id: place.id,
          name: place.name,
          category: place.category,
          coordinates: place.coordinates,
        });
      }
    }
    success(`${selectedIds.size} luoghi pianificati per il Giorno ${dayNumber}`);
    setSelectedIds(new Set());
  };

  const handleBatchDelete = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    for (const placeId of selectedIds) {
      await actions.removePlace(tripId, placeId);
    }
    success(`${selectedIds.size} luoghi rimossi`);
    setSelectedIds(new Set());
  };

  if (savedPlaces.length === 0) {
    return (
      <View className="bg-gray-50 border border-gray-100 rounded-2xl p-6 items-center justify-center my-4">
        <Ionicons name="heart-outline" size={32} color="#9CA3AF" className="mb-2" />
        <Typography variant="bodySemibold" className="text-gray-800 text-center">
          Nessun luogo salvato
        </Typography>
        <Typography variant="caption" className="text-gray-500 text-center mt-1">
          Cerca o esplora luoghi per aggiungerli alla tua libreria.
        </Typography>
      </View>
    );
  }

  // Identifica a quale giorno è assegnato un luogo
  const getAssignedDay = (placeId: string) => {
    if (!days) return undefined;
    const day = days.find(d => d.places.some(p => p.id === placeId));
    return day?.dayNumber;
  };

  const getIconForType = (category: string) => {
    switch (category) {
      case 'breakfast': return 'cafe-outline';
      case 'lunch':
      case 'dinner':
      case 'restaurant': return 'restaurant-outline';
      case 'drinks': return 'wine-outline';
      case 'sunset': return 'partly-sunny-outline';
      case 'walk': return 'walk-outline';
      case 'hotel': return 'bed-outline';
      case 'museum': return 'color-palette-outline';
      case 'landmark':
      case 'visit': return 'camera-outline';
      default: return 'map-outline';
    }
  };

  return (
    <View className="my-4">
      <View className="flex-row justify-between items-end mb-3">
        <Typography variant="h3">Libreria Luoghi ({savedPlaces.length})</Typography>
        {selectedIds.size > 0 && (
          <Pressable onPress={() => setSelectedIds(new Set())}>
            <Typography variant="captionMedium" className="text-gray-500">Annulla selezione</Typography>
          </Pressable>
        )}
      </View>

      {/* Batch Action Bar */}
      {selectedIds.size > 0 && (
        <View className="bg-gray-900 rounded-2xl p-3 mb-4 flex-row items-center justify-between shadow-sm">
          <Typography variant="bodySemibold" className="text-white ml-2">
            {selectedIds.size} selezionati
          </Typography>
          <View className="flex-row gap-2">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="max-w-[150px]">
              {days?.map(d => (
                <Pressable
                  key={d.dayNumber}
                  onPress={() => handleBatchAssign(d.dayNumber)}
                  className="bg-gray-800 px-3 py-1.5 rounded-lg mr-2 active:bg-gray-700"
                >
                  <Typography variant="captionMedium" className="text-white">G{d.dayNumber}</Typography>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={handleBatchDelete}
              className="bg-red-500/20 px-3 py-1.5 rounded-lg active:bg-red-500/30"
            >
              <Typography variant="captionMedium" className="text-red-400">Elimina</Typography>
            </Pressable>
          </View>
        </View>
      )}
      
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1 pb-4">
        {savedPlaces.map((place) => {
          const assignedDay = getAssignedDay(place.id);
          const isSelected = selectedIds.has(place.id);
          return (
            <View 
              key={place.id}
              className={`w-64 bg-white border rounded-2xl p-3.5 mx-1 shadow-sm flex-col justify-between ${
                isSelected ? 'border-gray-900 ring-2 ring-gray-900/20' : 'border-gray-100'
              }`}
            >
              <View>
                <Pressable 
                  onLongPress={() => toggleSelection(place.id)}
                  onPress={() => {
                    if (selectedIds.size > 0) toggleSelection(place.id);
                    else router.push(`/trip/${tripId}/places/${place.id}` as any);
                  }}
                  className="flex-row items-start justify-between mb-2 active:opacity-70"
                >
                  <View className="flex-1 pr-2">
                    <Typography variant="bodySemibold" className="text-gray-900 leading-tight" numberOfLines={1}>
                      {place.name}
                    </Typography>
                    <Typography variant="caption" className="text-gray-500 capitalize mt-0.5">
                      {place.category} • {place.durationMinutes || 60} min
                    </Typography>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={24} color="#111827" />
                  )}
                </Pressable>
                
                {assignedDay !== undefined ? (
                  <View className="flex-row items-center bg-green-50 self-start px-2.5 py-0.5 rounded-full border border-green-200 mt-1">
                    <Ionicons name="calendar-outline" size={10} color="#047857" />
                    <Typography variant="caption" className="text-green-800 ml-1 text-[10px] font-bold">
                      Pianificato Giorno {assignedDay}
                    </Typography>
                  </View>
                ) : (
                  <View className="flex-row items-center bg-amber-50/60 self-start px-2.5 py-0.5 rounded-full border border-amber-200 mt-1">
                    <Ionicons name="help-circle-outline" size={10} color="#D97706" />
                    <Typography variant="caption" className="text-amber-800 ml-1 text-[10px] font-bold">
                      Non assegnato
                    </Typography>
                  </View>
                )}
              </View>

              {/* Azioni rapide di assegnazione alle giornate */}
              <View className="border-t border-gray-100 pt-2.5 mt-3">
                <View className="flex-row justify-between items-center mb-1.5">
                  <Typography variant="captionMedium" className="text-gray-400 text-[10px] uppercase">
                    {assignedDay !== undefined ? 'Sposta nel giorno:' : 'Pianifica nel giorno:'}
                  </Typography>
                  <Pressable
                    onPress={async () => {
                      await actions.assignPlaceToDay(tripId, undefined, {
                        id: place.id,
                        name: place.name,
                        category: place.category,
                        coordinates: place.coordinates,
                      });
                      await actions.removePlace(tripId, place.id);
                    }}
                    className="active:opacity-60"
                  >
                    <Typography variant="captionMedium" className="text-red-500 text-[10px] font-bold uppercase">
                      Elimina
                    </Typography>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-1.5">
                  <Pressable
                    onPress={() => actions.assignPlaceToDay(tripId, undefined, {
                      id: place.id,
                      name: place.name,
                      category: place.category,
                      coordinates: place.coordinates,
                    })}
                    className={`px-2.5 py-1.5 rounded-lg border ${
                      assignedDay === undefined 
                        ? 'bg-gray-200 border-gray-300' 
                        : 'bg-white border-gray-200 active:bg-gray-100'
                    }`}
                  >
                    <Typography variant="captionMedium" className="text-gray-700 text-[10px]">
                      Libreria
                    </Typography>
                  </Pressable>
                  
                  {days?.map((d) => {
                    const isSelected = assignedDay === d.dayNumber;
                    return (
                      <Pressable
                        key={d.dayNumber}
                        onPress={async () => {
                          const placeRef = {
                            id: place.id,
                            name: place.name,
                            category: place.category,
                            coordinates: place.coordinates,
                            coverImageUrl: place.coverImageUrl,
                            address: place.address,
                            rating: place.rating,
                            durationMinutes: place.durationMinutes,
                          };
                          await actions.assignPlaceToDay(tripId, d.dayNumber, placeRef);
                        }}
                        className={`px-2.5 py-1.5 rounded-lg border ${
                          isSelected 
                            ? 'bg-[#4A6741] border-[#4A6741]' 
                            : 'bg-gray-900 border-gray-900 active:bg-gray-800'
                        }`}
                      >
                        <Typography variant="captionMedium" className="text-white text-[10px]">
                          G{d.dayNumber}
                        </Typography>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};
