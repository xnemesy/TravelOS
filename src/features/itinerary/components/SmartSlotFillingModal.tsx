import React, { useMemo, useState, useEffect } from 'react';
import { View, Pressable, ScrollView, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../shared/components/Typography';
import { TextField } from '../../../shared/components/forms/TextField';
import { PlaceRef, TimelineDaySchedule } from '../../../core/engines/types/context.types';
import { TravelServices } from '../../../domain/providers/TravelServices';
import * as Haptics from 'expo-haptics';

interface SmartSlotFillingModalProps {
  visible: boolean;
  slotBlock: PlaceRef | null;
  availablePlaces: PlaceRef[];
  days: TimelineDaySchedule[];
  destinationName: string;
  onClose: () => void;
  onConfirm: (place: PlaceRef) => void;
  onExplore: () => void;
}

export const SmartSlotFillingModal = ({
  visible,
  slotBlock,
  availablePlaces,
  days,
  destinationName,
  onClose,
  onConfirm,
  onExplore
}: SmartSlotFillingModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [previewPlaceId, setPreviewPlaceId] = useState<string | null>(null);
  const [liveSuggestions, setLiveSuggestions] = useState<PlaceRef[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    if (!visible || !slotBlock || !destinationName) return;
    setLiveSuggestions([]);
    setPreviewPlaceId(null);
    setSearchQuery('');

    const fetchLiveSuggestions = async () => {
      setLoadingSuggestions(true);
      try {
        let query = '';
        const cat = slotBlock.category;
        if (cat === 'breakfast') {
          query = `caffetteria bar colazione pasticceria ${destinationName}`;
        } else if (cat === 'lunch' || cat === 'dinner') {
          query = `ristorante trattoria pizzeria osteria ${destinationName}`;
        } else if (cat === 'sunset') {
          query = `punto panoramico vista ${destinationName}`;
        } else if (cat === 'free_time' || cat === 'relax') {
          query = `parco giardini relax ${destinationName}`;
        } else {
          query = `${cat} ${destinationName}`;
        }

        const rawResults = await TravelServices.places().searchPlaces(query);
        const results = rawResults.map(p => ({
          id: p.placeId,
          name: p.name,
          category: slotBlock.category,
          coordinates: { latitude: p.lat, longitude: p.lon },
          coverImageUrl: p.coverImageUrl || (p.photoUrls?.[0]) || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=400&q=80',
          address: p.formattedAddress,
          rating: p.rating,
          durationMinutes: slotBlock.durationMinutes || 60,
        } as PlaceRef));
        
        setLiveSuggestions(results);
      } catch (err) {
        console.warn('[SmartSlotFillingModal] error fetching live suggestions:', err);
      } finally {
        setLoadingSuggestions(false);
      }
    };

    fetchLiveSuggestions();
  }, [visible, slotBlock, destinationName]);

  const getCategoryFromBlock = (block: PlaceRef | null) => {
    if (!block) return null;
    const cat = block.category;
    if (cat === 'breakfast') return ['breakfast', 'cafe', 'bakery'];
    if (cat === 'lunch' || cat === 'dinner') return ['restaurant', 'food', 'lunch', 'dinner'];
    if (cat === 'sunset') return ['viewpoint', 'landmark', 'nature', 'sunset'];
    if (cat === 'free_time' || cat === 'relax') return ['park', 'nature', 'cafe', 'free_time'];
    return [cat];
  };

  const getAssignedDay = (placeId: string) => {
    for (const day of days) {
      if (day.places.some(p => p.id === placeId)) {
        return day.dayNumber;
      }
    }
    return null;
  };

  // Unisce i luoghi salvati dell'utente con i suggerimenti live
  const combinedPlaces = useMemo(() => {
    const savedIds = new Set(availablePlaces.map(p => p.id));
    // Filtriamo i liveSuggestions escludendo quelli già presenti nei salvati
    const newSuggestions = liveSuggestions.filter(p => !savedIds.has(p.id));
    return [...availablePlaces, ...newSuggestions];
  }, [availablePlaces, liveSuggestions]);

  const sortedAndFilteredPlaces = useMemo(() => {
    let filtered = combinedPlaces;
    if (searchQuery) {
      const lowerQ = searchQuery.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(lowerQ));
    }

    const preferredCategories = getCategoryFromBlock(slotBlock);

    return filtered.sort((a, b) => {
      // 1. Suggested (same category)
      const aPref = preferredCategories?.some(c => a.category.includes(c)) ? 1 : 0;
      const bPref = preferredCategories?.some(c => b.category.includes(c)) ? 1 : 0;
      if (aPref !== bPref) return bPref - aPref;

      // 2. Saved vs Live Suggestion (prefer saved first)
      const aIsSaved = availablePlaces.some(p => p.id === a.id) ? 1 : 0;
      const bIsSaved = availablePlaces.some(p => p.id === b.id) ? 1 : 0;
      if (aIsSaved !== bIsSaved) return bIsSaved - aIsSaved;
      
      // 3. Unassigned vs Assigned
      const aDay = getAssignedDay(a.id);
      const bDay = getAssignedDay(b.id);
      if (aDay === null && bDay !== null) return -1;
      if (aDay !== null && bDay === null) return 1;

      // 4. Alphabetical
      return a.name.localeCompare(b.name);
    });
  }, [combinedPlaces, searchQuery, slotBlock, days, availablePlaces]);

  const getIconForCategory = (category: string) => {
    if (category.includes('breakfast') || category.includes('cafe')) return 'cafe-outline';
    if (category.includes('restaurant') || category.includes('food')) return 'restaurant-outline';
    if (category.includes('drinks') || category.includes('bar')) return 'wine-outline';
    if (category.includes('park') || category.includes('nature')) return 'leaf-outline';
    if (category.includes('museum') || category.includes('culture')) return 'color-palette-outline';
    return 'location-outline';
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={onClose}>
        <Pressable 
          className="bg-white rounded-t-3xl p-6 shadow-xl h-[85%]" 
          onPress={(e) => e.stopPropagation()}
        >
          <View className="w-12 h-1 bg-gray-200 rounded-full self-center mb-6" />
          
          <View className="flex-row items-center mb-4">
            <View className="w-10 h-10 bg-[#4A6741]/10 rounded-full items-center justify-center mr-3">
              <Typography variant="h2">✨</Typography>
            </View>
            <View>
              <Typography variant="h2" className="text-gray-900 text-xl leading-tight">
                Smart Slot Filling
              </Typography>
              <Typography variant="captionMedium" className="text-gray-500">
                Sostituisci "{slotBlock?.name || 'lo slot'}" con un luogo reale
              </Typography>
            </View>
          </View>

          {loadingSuggestions && combinedPlaces.length === 0 ? (
            <View className="flex-1 items-center justify-center py-10">
              <ActivityIndicator size="large" color="#4A6741" />
              <Typography variant="body" className="text-gray-500 mt-4">Caricamento suggerimenti in corso...</Typography>
            </View>
          ) : combinedPlaces.length === 0 ? (
            <View className="flex-1 items-center justify-center py-10 px-4">
              <Ionicons name="search-outline" size={48} color="#D1D5DB" className="mb-4" />
              <Typography variant="h3" className="text-gray-900 mb-2 text-center">Nessun luogo trovato</Typography>
              <Typography variant="body" className="text-gray-500 text-center mb-6">
                Non abbiamo trovato luoghi salvati o consigliati per questo slot.
              </Typography>
              <Pressable 
                onPress={onExplore}
                className="bg-[#4A6741] px-6 py-3 rounded-full active:opacity-80"
              >
                <Typography variant="bodySemibold" className="text-white">Esplora la Guida</Typography>
              </Pressable>
            </View>
          ) : (
            <>
              {(availablePlaces.length >= 10 || liveSuggestions.length > 0) && (
                <TextField
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Cerca nei luoghi..."
                  leftIcon="search"
                  containerClassName="mb-4"
                />
              )}

              {loadingSuggestions && (
                <View className="py-2 flex-row items-center justify-center">
                  <ActivityIndicator size="small" color="#4A6741" className="mr-2" />
                  <Typography variant="captionMedium" className="text-gray-500">Aggiornamento suggerimenti live...</Typography>
                </View>
              )}

              <ScrollView showsVerticalScrollIndicator={false} className="flex-1 mb-4">
                {sortedAndFilteredPlaces.map(place => {
                  const preferredCategories = getCategoryFromBlock(slotBlock);
                  const isSuggested = preferredCategories?.some(c => place.category.includes(c));
                  const assignedDay = getAssignedDay(place.id);
                  const isPreviewing = previewPlaceId === place.id;
                  const isSaved = availablePlaces.some(p => p.id === place.id);

                  return (
                    <Pressable
                      key={place.id}
                      onPress={() => {
                        if (isPreviewing) {
                          onConfirm(place);
                        } else {
                          Haptics.selectionAsync();
                          setPreviewPlaceId(place.id);
                        }
                      }}
                      className={`p-4 mb-3 rounded-2xl border transition-colors ${
                        isPreviewing 
                          ? 'border-[#4A6741] bg-green-50/20 shadow-sm' 
                          : 'border-gray-100 bg-white active:bg-gray-50'
                      }`}
                    >
                      <View className="flex-row items-center justify-between mb-1">
                        <View className="flex-row items-center flex-1 mr-2">
                          <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isSuggested ? 'bg-amber-100' : 'bg-gray-100'}`}>
                            <Ionicons name={getIconForCategory(place.category) as any} size={16} color={isSuggested ? "#D97706" : "#6B7280"} />
                          </View>
                          <Typography variant="bodySemibold" className="text-gray-900 text-[15px] flex-1" numberOfLines={1}>
                            {place.name}
                          </Typography>
                        </View>
                        
                        {!isSaved ? (
                          <View className="bg-green-100 px-2 py-0.5 rounded-md flex-row items-center">
                            <Ionicons name="sparkles" size={10} color="#059669" className="mr-1" />
                            <Typography variant="caption" className="text-green-800 text-[10px] font-bold">LIVE SUGGESTION</Typography>
                          </View>
                        ) : isSuggested && assignedDay === null ? (
                          <View className="bg-amber-100 px-2 py-0.5 rounded-md">
                            <Typography variant="caption" className="text-amber-800 text-[10px] font-bold">⭐ CONSIGLIATO</Typography>
                          </View>
                        ) : assignedDay !== null ? (
                          <View className="bg-blue-100 px-2 py-0.5 rounded-md flex-row items-center">
                            <Ionicons name="calendar" size={10} color="#1D4ED8" className="mr-1" />
                            <Typography variant="caption" className="text-blue-800 text-[10px] font-bold">GIORNO {assignedDay}</Typography>
                          </View>
                        ) : (
                          <View className="bg-gray-100 px-2 py-0.5 rounded-md">
                            <Typography variant="caption" className="text-gray-600 text-[10px] font-bold">📍 SALVATO</Typography>
                          </View>
                        )}
                      </View>

                      {place.address && (
                        <Typography variant="caption" className="text-gray-500 ml-11 mb-1" numberOfLines={1}>
                          {place.address}
                        </Typography>
                      )}

                      {place.rating !== undefined && place.rating > 0 && (
                        <View className="flex-row items-center ml-11">
                          <Ionicons name="star" size={12} color="#F59E0B" />
                          <Typography variant="caption" className="text-gray-600 ml-1 font-bold">
                            {place.rating.toFixed(1)}
                          </Typography>
                        </View>
                      )}

                      {isPreviewing && (
                        <View className="mt-3 pt-3 border-t border-[#4A6741]/10">
                          <Typography variant="captionMedium" className="text-gray-600 mb-2">
                            Sostituirai <Typography variant="captionSemibold" className="text-gray-800">{slotBlock?.name}</Typography> con <Typography variant="captionSemibold" className="text-gray-800">{place.name}</Typography>.
                            {!isSaved && " Il luogo verrà salvato anche nella tua Libreria."}
                          </Typography>
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center bg-green-100/50 px-2.5 py-1 rounded-md">
                              <Ionicons name="checkmark-circle" size={14} color="#059669" />
                              <Typography variant="captionMedium" className="text-green-800 ml-1.5 text-[11px]">Nessun conflitto d'orario</Typography>
                            </View>
                            <Pressable 
                              onPress={() => onConfirm(place)}
                              className="bg-[#4A6741] px-4 py-1.5 rounded-full"
                            >
                              <Typography variant="captionSemibold" className="text-white">Conferma Assegnazione</Typography>
                            </Pressable>
                          </View>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
