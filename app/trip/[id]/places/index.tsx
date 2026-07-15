import React, { useState, useEffect, useMemo } from 'react';
import { View, Pressable, StatusBar, ScrollView, ImageBackground, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../../src/shared/components/Typography';
import { TextField } from '../../../../src/shared/components/forms/TextField';
import { usePlaces, useTravelActions, useTimeline } from '../../../../src/shared/hooks';
import { PlaceRef } from '../../../../src/core/engines/types/context.types';
import { TravelServices } from '../../../../src/domain/providers/TravelServices';
import { PlaceMetadata } from '../../../../src/domain/providers/travel-providers.types';
import { useTripStore } from '../../../../src/features/trips/store/trip.store';
import { PlaceMergeEngine } from '../../../../src/domain/trip/engine/PlaceMergeEngine';

import { radius } from '../../../../src/core/theme/radius';
import { 
  EDITORIAL_COLLECTIONS, 
  getEditorialPlacesForDestination, 
  EditorialCollectionTag, 
  EditorialPlaceItem 
} from '../../../../src/features/places/catalog/editorial-places.catalog';

/**
 * ============================================================================
 * PLACES LIST SCREEN (GUIDA EDITORIALE / LIBRERIA LUOGHI)
 * ============================================================================
 * Conforme alla Regola d'Oro: legge esclusivamente tramite usePlaces(tripId)
 * e useTripStore. Implementa la doppia modalità: "Scopri (Catalogo Editoriale)"
 * e "I miei luoghi (Libreria personale)".
 */
export default function PlacesListScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ id: string | string[]; day?: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ id: string | string[]; day?: string | string[] }>();
  const idParam = localParams.id || globalParams.id;
  const tripId = (Array.isArray(idParam) ? idParam[0] : idParam) || 'trip-budapest-2026';
  
  const { savedPlaces } = usePlaces(tripId);
  const { days } = useTimeline(tripId);
  const actions = useTravelActions();
  const trip = useTripStore((s) => s.getTripById(tripId));
  const destination = trip?.destination || 'Budapest';

  // Modalità principale: 'consigliati' (Catalogo Editoriale) | 'cerca' (Live Provider) | 'libreria' (I miei luoghi)
  const [activeTab, setActiveTab] = useState<'consigliati' | 'cerca' | 'libreria'>('consigliati');

  // Stato per la modalità Consigliati
  const [activeCollection, setActiveCollection] = useState<'tutti' | EditorialCollectionTag>('tutti');
  
  // Stato per la modalità Cerca Live
  const [externalQuery, setExternalQuery] = useState('');
  const [externalResults, setExternalResults] = useState<PlaceMetadata[]>([]);
  const [isSearchingExternal, setIsSearchingExternal] = useState(false);
  
  // Stato per il giorno di destinazione in cui aggiungere le tappe
  const targetDayParam = localParams.day || globalParams.day;
  const initialTargetDay = targetDayParam ? parseInt(Array.isArray(targetDayParam) ? targetDayParam[0] : targetDayParam, 10) : undefined;
  const [targetDay, setTargetDay] = useState<number | undefined>(initialTargetDay);

  // Stato per la modalità Libreria
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('Tutte');
  const filters = ['Tutte', 'Da pianificare', 'Pianificate', '⭐ Preferite'];

  const [liveEditorialPlaces, setLiveEditorialPlaces] = useState<any[]>([]);
  const [isLiveLoading, setIsLiveLoading] = useState(false);

  const isCurated = ['budapest', 'kyoto', 'parigi', 'roma'].includes(destination.toLowerCase().trim());

  useEffect(() => {
    if (isCurated) {
      setLiveEditorialPlaces([]);
      return;
    }

    const collectionQueries: Record<string, string> = {
      tutti: `${destination} cose da vedere`,
      imperdibili: `${destination} attrazioni principali`,
      colazione: `${destination} migliori bar colazione pasticceria`,
      ristoranti: `${destination} migliori ristoranti tipici`,
      tramonto: `${destination} punti panoramici belvedere`,
      se_piove: `${destination} musei e luoghi al coperto`,
      passeggiata: `${destination} parchi giardini passeggiate`,
      gemme_nascoste: `${destination} luoghi particolari segreti`
    };

    const query = collectionQueries[activeCollection] || `${destination} attrazioni`;
    
    setIsLiveLoading(true);
    TravelServices.places().searchPlaces(query)
      .then((res) => {
        const mapped = res.map((p) => {
          const notes: Record<string, string> = {
            tutti: `Una tappa fondamentale consigliata durante la tua visita a ${destination}.`,
            imperdibili: `Uno dei luoghi più iconici e fotografati di ${destination}, assolutamente da non perdere.`,
            colazione: `Il posto ideale a ${destination} per iniziare la giornata con ottimi prodotti locali.`,
            ristoranti: `Consigliato per assaporare la cucina tipica e i sapori tradizionali della zona di ${destination}.`,
            tramonto: `Offre uno degli scorci panoramici più suggestivi di ${destination}, consigliato all'ora d'oro.`,
            se_piove: `Perfetto per trascorrere qualche ora alla scoperta della cultura di ${destination} al riparo dalla pioggia.`,
            passeggiata: `Immerso nel verde o tra i vicoli storici, ideale per rilassarsi camminando a ${destination}.`,
            gemme_nascoste: `Un angolo meno noto ma ricco di fascino, amato dagli abitanti di ${destination}.`
          };

          return {
            id: p.placeId,
            destinationName: destination,
            baseData: {
              providerId: p.placeId,
              name: p.name,
              category: p.category,
              coverImageUrl: p.coverImageUrl,
              location: { address: p.formattedAddress || '' },
              rating: p.rating || 4.7
            },
            collections: [activeCollection],
            editorialNote: notes[activeCollection] || `Luogo consigliato a ${destination}.`,
            recommendedDurationMinutes: p.durationMinutes || 60,
            averageCost: p.priceLevel ? p.priceLevel * 15 : undefined
          };
        });
        setLiveEditorialPlaces(mapped);
      })
      .catch((err) => {
        console.error('[PlacesIndex] Failed to fetch live collections:', err);
        setLiveEditorialPlaces([]);
      })
      .finally(() => {
        setIsLiveLoading(false);
      });
  }, [destination, activeCollection, isCurated]);

  const editorialPlaces = useMemo(() => {
    if (isCurated) {
      return getEditorialPlacesForDestination(
        destination, 
        activeCollection === 'tutti' ? undefined : activeCollection
      );
    }
    return liveEditorialPlaces;
  }, [isCurated, destination, activeCollection, liveEditorialPlaces]);

  // Espansione dei sinonimi per la ricerca in Italiano / Inglese
  const expandSearchQuery = (query: string): string[] => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    
    const synonyms: Record<string, string[]> = {
      'ristorant': ['restaurant', 'food', 'lunch', 'dinner', 'cena', 'pranzo', 'ristorante', 'ristoranti', 'mangiare', 'cibo'],
      'cibo': ['restaurant', 'food', 'lunch', 'dinner', 'eat', 'cibo', 'mangiare'],
      'mangiare': ['restaurant', 'food', 'lunch', 'dinner', 'cibo', 'mangiare'],
      'museo': ['museum', 'culture', 'arte', 'mostra', 'musei'],
      'musei': ['museum', 'culture', 'arte', 'mostra', 'musei'],
      'monument': ['landmark', 'monumento', 'monumenti', 'attrazione', 'attrazioni'],
      'monumento': ['landmark', 'monumento', 'monumenti', 'attrazione', 'attrazioni'],
      'monumenti': ['landmark', 'monumento', 'monumenti', 'attrazione', 'attrazioni'],
      'parco': ['park', 'nature', 'parco', 'parchi', 'giardino', 'verde'],
      'parchi': ['park', 'nature', 'parco', 'parchi', 'giardino', 'verde'],
      'giardino': ['park', 'nature', 'parco', 'parchi', 'giardino', 'verde'],
      'bar': ['bar', 'drinks', 'aperitivo', 'cocktail', 'pub', 'bere'],
      'pub': ['bar', 'drinks', 'aperitivo', 'cocktail', 'pub', 'bere'],
      'bere': ['bar', 'drinks', 'aperitivo', 'cocktail', 'pub', 'bere'],
      'colazione': ['breakfast', 'cafe', 'coffee', 'caffè', 'caffe'],
      'caffè': ['cafe', 'coffee', 'breakfast', 'caffè', 'caffe'],
      'caffe': ['cafe', 'coffee', 'breakfast', 'caffè', 'caffe'],
    };

    const matches = [q];
    for (const key in synonyms) {
      if (q.includes(key) || key.includes(q)) {
        matches.push(...synonyms[key]);
      }
    }
    return Array.from(new Set(matches));
  };

  // Filtro per i luoghi editoriali (Ricerca)
  const filteredEditorialPlaces = editorialPlaces.filter((place) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    
    const terms = expandSearchQuery(searchQuery);
    return terms.some(term => 
      (place.baseData.name && place.baseData.name.toLowerCase().includes(term)) ||
      (place.baseData.category && place.baseData.category.toLowerCase().includes(term)) ||
      (place.editorialNote && place.editorialNote.toLowerCase().includes(term))
    );
  });

  // Filtro per i luoghi salvati
  const filteredPlaces = savedPlaces.filter((place) => {
    // Determina se il luogo è pianificato
    const isPlanned = days?.some(d => d.places?.some(p => p.id === place.id));

    let passFilter = true;
    if (activeFilter === 'Da pianificare') passFilter = !isPlanned;
    if (activeFilter === 'Pianificate') passFilter = isPlanned;
    if (activeFilter === '⭐ Preferite') passFilter = place.priority === 'must_see'; // O assumiamo che 'must_see' siano le preferite o che ci sia un flag 'isFavorite' (usiamo priority per ora)
    
    if (!passFilter) return false;

    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;

    const terms = expandSearchQuery(searchQuery);
    const matchesSearch = terms.some(term => 
      (place.name && place.name.toLowerCase().includes(term)) ||
      (place.category && place.category.toLowerCase().includes(term)) ||
      (place.address && place.address.toLowerCase().includes(term)) ||
      (place.notes && place.notes.toLowerCase().includes(term))
    );
    
    return matchesSearch;
  });

  const getIconForType = (category: string) => {
    switch (category) {
      case 'restaurant': return 'restaurant-outline';
      case 'hotel': return 'bed-outline';
      case 'museum': return 'color-palette-outline';
      case 'landmark': return 'camera-outline';
      case 'experience': return 'sparkles-outline';
      case 'viewpoint': return 'image-outline';
      case 'nature': return 'leaf-outline';
      case 'bar': return 'wine-outline';
      default: return 'business-outline';
    }
  };

  const handleAddPlace = async (item: EditorialPlaceItem) => {
    const coords = item.baseData.location?.coordinates;
    const placeRef: PlaceRef = {
      id: item.id,
      name: item.baseData.name,
      category: item.baseData.category,
      coverImageUrl: item.baseData.coverImageUrl,
      coordinates: coords ? { latitude: coords.lat, longitude: coords.lng } : undefined,
      address: item.baseData.location?.address,
      rating: item.baseData.rating,
      priority: item.collections.includes('imperdibili') ? 'must_see' : 'recommended',
      notes: item.editorialNote,
      durationMinutes: item.recommendedDurationMinutes,
    };
    
    // Salva
    await actions.savePlace(tripId, placeRef);
    
    // Pianifica sul giorno di destinazione selezionato
    await actions.assignPlaceToDay(tripId, targetDay, placeRef);
  };

  const handleExternalSearch = async (text: string) => {
    setExternalQuery(text);
    if (!text.trim()) {
      setExternalResults([]);
      return;
    }
    setIsSearchingExternal(true);
    try {
      const res = await TravelServices.places().searchPlaces(text);
      setExternalResults(res);
    } catch (e) {
      setExternalResults([]);
    } finally {
      setIsSearchingExternal(false);
    }
  };

  const handleSearchNearby = async () => {
    setIsSearchingExternal(true);
    try {
      // Risolvi dinamicamente le coordinate per la destinazione corrente del viaggio
      const destResults = await TravelServices.places().searchPlaces(destination);
      let lat = 47.4979;
      let lon = 19.0402;
      
      if (destResults && destResults.length > 0) {
        lat = destResults[0].lat;
        lon = destResults[0].lon;
      }

      const res = await TravelServices.places().searchNearby(lat, lon, 5000);
      setExternalResults(res);
      setExternalQuery(`Dintorni (${destination})`);
    } catch (e) {
      setExternalResults([]);
    } finally {
      setIsSearchingExternal(false);
    }
  };

  const handleAddExternalPlace = async (meta: PlaceMetadata) => {
    // Cerca se esiste già un duplicato nei luoghi salvati
    const existing = savedPlaces.find(p => 
      PlaceMergeEngine.isSamePlace(
        { name: p.name, lat: p.coordinates?.latitude, lon: p.coordinates?.longitude },
        { name: meta.name, lat: meta.lat, lon: meta.lon }
      )
    );

    const placeRef: PlaceRef = existing ? {
      id: existing.id,
      name: existing.name,
      category: existing.category,
      coverImageUrl: existing.coverImageUrl,
      coordinates: existing.coordinates,
      address: existing.address,
      rating: existing.rating,
      priority: existing.priority,
      notes: existing.notes,
      durationMinutes: existing.durationMinutes,
    } : {
      id: meta.placeId,
      name: meta.name,
      category: meta.category || 'landmark',
      coverImageUrl: meta.coverImageUrl || 'https://images.unsplash.com/photo-1517840908100-89a17d7390fd?auto=format&fit=crop&w=800&q=80',
      coordinates: { latitude: meta.lat, longitude: meta.lon },
      address: meta.formattedAddress,
      rating: meta.rating,
      priority: 'recommended',
      notes: `Aggiunto dal mondo reale (Provider Live)`,
      durationMinutes: 60,
    };
    
    await actions.savePlace(tripId, placeRef);
    
    // Non aggiungere nuovamente alla timeline se è già schedulato
    const scheduled = isPlaceScheduled(placeRef.id);
    if (!scheduled) {
      await actions.assignPlaceToDay(tripId, targetDay, placeRef);
    }
  };

  const isPlaceScheduled = (placeId: string) => {
    return days?.some(day => day.places.some(p => p.id === placeId)) || false;
  };

  const isPlaceSaved = (placeId: string) => {
    return savedPlaces?.some(p => p.id === placeId) || false;
  };

  const CATEGORY_MAP: Record<string, { emoji: string; label: string }> = {
    attraction: { emoji: '🏛️', label: 'Attrazione' },
    museum: { emoji: '🖼️', label: 'Museo' },
    church: { emoji: '⛪', label: 'Chiesa' },
    restaurant: { emoji: '🍽️', label: 'Ristorante' },
    cafe: { emoji: '☕', label: 'Caffè' },
    viewpoint: { emoji: '🌅', label: 'Belvedere' },
    park: { emoji: '🌳', label: 'Parco' },
    shopping: { emoji: '🛍️', label: 'Shopping' },
    nightlife: { emoji: '✨', label: 'Movida' },
    hotel: { emoji: '🏨', label: 'Hotel' },
    transport: { emoji: '🚇', label: 'Trasporto' },
    food: { emoji: '🍽️', label: 'Ristorante' },
    experience: { emoji: '✨', label: 'Esperienza' },
    nature: { emoji: '🌳', label: 'Natura' }
  };

  const getCategoryDisplay = (cat: string) => {
    const normalized = cat?.toLowerCase() || 'attraction';
    return CATEGORY_MAP[normalized] || { emoji: '📍', label: cat || 'Luogo' };
  };

  const getButtonDisplayForPlace = (placeId: string) => {
    const scheduledDay = days?.find(day => day.places.some(p => p.id === placeId));
    const saved = isPlaceSaved(placeId);
    
    if (scheduledDay) {
      return { text: `✓ Giorno ${scheduledDay.dayNumber}`, active: true };
    }
    if (saved) {
      return { text: '✓ In Libreria', active: true };
    }
    return { text: 'Aggiungi', active: false };
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View className="px-5 pt-3 pb-3 flex-row items-center justify-between border-b border-gray-100">
        <Pressable 
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center active:opacity-70"
        >
          <Ionicons name="arrow-back" size={20} color="#1C1C1E" />
        </Pressable>
        
        <View className="items-center">
          <Typography variant="h3" className="text-gray-900 font-serif">
            {`Scopri ${destination}`}
          </Typography>
        </View>

        <View className="w-10" />
      </View>

      {/* Apple iOS-style Search Bar */}
      <View className="px-5 mb-1 mt-1 bg-white">
        <TextField
          value={activeTab === 'cerca' ? externalQuery : searchQuery}
          onChangeText={activeTab === 'cerca' ? handleExternalSearch : setSearchQuery}
          placeholder={
            activeTab === 'consigliati' ? "Cerca tra i consigliati..." :
            activeTab === 'cerca' ? "Cerca nel mondo (es. New York Cafe, Parlamento)..." :
            "Cerca tra i tuoi luoghi salvati..."
          }
          autoCapitalize="none"
          leftIcon="search"
          rightIcon={(activeTab === 'cerca' ? externalQuery.length > 0 : searchQuery.length > 0) ? "close-circle" : undefined}
          onRightIconPress={() => {
            if (activeTab === 'cerca') {
              setExternalQuery('');
              setExternalResults([]);
            } else {
              setSearchQuery('');
            }
          }}
          containerClassName="mb-0"
        />
      </View>

      {/* Day Planning Selector panel */}
      {days && days.length > 0 && (
        <View className="bg-gray-50 border-b border-gray-100 px-5 py-2.5 flex-row items-center justify-between">
          <Typography variant="captionMedium" className="text-gray-500 uppercase tracking-wider text-[10px]">
            Aggiungi le tappe al:
          </Typography>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={{ gap: 6, paddingLeft: 10 }}
          >
            <Pressable
              onPress={() => setTargetDay(undefined)}
              className={`px-3 py-1 rounded-lg border ${
                targetDay === undefined 
                  ? 'bg-gray-800 border-gray-800' 
                  : 'bg-white border-gray-200 active:bg-gray-100'
              }`}
            >
              <Typography variant="caption" className={`text-[11px] font-medium ${targetDay === undefined ? 'text-white font-bold' : 'text-gray-600'}`}>
                Solo Libreria
              </Typography>
            </Pressable>

            {days.map(d => {
              const isSelected = targetDay === d.dayNumber;
              return (
                <Pressable
                  key={d.dayNumber}
                  onPress={() => setTargetDay(d.dayNumber)}
                  className={`px-3 py-1 rounded-lg border ${
                    isSelected 
                      ? 'bg-[#4A6741] border-[#4A6741]' 
                      : 'bg-white border-gray-200 active:bg-gray-100'
                  }`}
                >
                  <Typography variant="caption" className={`text-[11px] font-medium ${isSelected ? 'text-white font-bold' : 'text-gray-600'}`}>
                    Giorno {d.dayNumber}
                  </Typography>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Segmented Control / Tab Toggle */}
      <View className="px-5 py-3 bg-white">
        <View className="flex-row bg-gray-100 p-1 rounded-2xl">
          <Pressable
            onPress={() => setActiveTab('consigliati')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center ${
              activeTab === 'consigliati' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Typography 
              variant="bodySemibold" 
              className={activeTab === 'consigliati' ? 'text-gray-900 font-bold text-xs' : 'text-gray-500 text-xs'}
            >
              ✨ Consigliati
            </Typography>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('cerca')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center ${
              activeTab === 'cerca' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Typography 
              variant="bodySemibold" 
              className={activeTab === 'cerca' ? 'text-gray-900 font-bold text-xs' : 'text-gray-500 text-xs'}
            >
              🔍 Cerca live
            </Typography>
          </Pressable>

          <Pressable
            onPress={() => setActiveTab('libreria')}
            className={`flex-1 py-2 rounded-xl flex-row items-center justify-center ${
              activeTab === 'libreria' ? 'bg-white shadow-sm' : ''
            }`}
          >
            <Typography 
              variant="bodySemibold" 
              className={activeTab === 'libreria' ? 'text-gray-900 font-bold text-xs' : 'text-gray-500 text-xs'}
            >
              📚 I miei ({savedPlaces.length})
            </Typography>
          </Pressable>
        </View>
      </View>

      {/* ===================================================================== */}
      {/* MODALITÀ 1: CONSIGLIATI (GUIDA EDITORIALE CURATA)                     */}
      {/* ===================================================================== */}
      {activeTab === 'consigliati' ? (
        <View className="flex-1">
          {/* Orizzontale Collezioni Filter Pills */}
          <View className="py-2">
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              <Pressable
                onPress={() => setActiveCollection('tutti')}
                className={`px-4 py-2 rounded-full mr-2.5 flex-row items-center border ${
                  activeCollection === 'tutti' 
                    ? 'bg-gray-900 border-gray-900 shadow-sm' 
                    : 'bg-white border-gray-200'
                }`}
              >
                <Typography variant="captionMedium" className={activeCollection === 'tutti' ? 'text-white font-bold' : 'text-gray-700'}>
                  ✨ Tutte le collezioni
                </Typography>
              </Pressable>

              {EDITORIAL_COLLECTIONS.map((col) => {
                const isSelected = activeCollection === col.id;
                return (
                  <Pressable
                    key={col.id}
                    onPress={() => setActiveCollection(col.id)}
                    className={`px-4 py-2 rounded-full mr-2.5 flex-row items-center border ${
                      isSelected 
                        ? 'bg-gray-900 border-gray-900 shadow-sm' 
                        : 'bg-white border-gray-200'
                    }`}
                  >
                    <Typography variant="captionMedium" className={isSelected ? 'text-white font-bold' : 'text-gray-700'}>
                      {col.title}
                    </Typography>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Banner Descrizione Collezione Attiva */}
          {activeCollection !== 'tutti' && (
            <View className="mx-5 my-2 p-3.5 bg-green-50/70 border border-green-200 rounded-2xl flex-row items-center">
              <Typography variant="h2" className="text-2xl mr-3">
                {EDITORIAL_COLLECTIONS.find(c => c.id === activeCollection)?.icon}
              </Typography>
              <View className="flex-1">
                <Typography variant="bodySemibold" className="text-green-950 font-bold text-sm">
                  {EDITORIAL_COLLECTIONS.find(c => c.id === activeCollection)?.title.replace(/^.\s/, '')}
                </Typography>
                <Typography variant="caption" className="text-green-800 text-xs mt-0.5">
                  {EDITORIAL_COLLECTIONS.find(c => c.id === activeCollection)?.description}
                </Typography>
              </View>
            </View>
          )}

          {/* Elenco Luoghi Editoriali */}
          {isLiveLoading ? (
            <View className="flex-1 items-center justify-center py-24">
              <Typography variant="bodySemibold" className="text-gray-500 italic">
                Esploro le collezioni in tempo reale...
              </Typography>
            </View>
          ) : filteredEditorialPlaces.length === 0 ? (
            <View className="flex-1 items-center justify-center py-20 px-8">
              <View className="w-16 h-16 rounded-full bg-amber-50 items-center justify-center mb-4 border border-amber-100">
                <Ionicons name="alert-circle-outline" size={28} color="#D97706" />
              </View>
              <Typography variant="h3" className="text-gray-900 text-center font-serif mb-2">
                Nessun luogo in questa collezione
              </Typography>
              <Typography variant="body" className="text-gray-500 text-center leading-relaxed">
                Non abbiamo trovato luoghi reali per questa collezione a {destination}. Prova con un'altra categoria!
              </Typography>
            </View>
          ) : (
            <ScrollView className="flex-1 px-5 pt-2" showsVerticalScrollIndicator={false}>
              {filteredEditorialPlaces.map((item) => {
                const scheduled = isPlaceScheduled(item.id);
                return (
                  <Pressable 
                    key={item.id} 
                    onPress={() => router.push(`/trip/${tripId}/places/${item.id}` as any)}
                    className="bg-white rounded-3xl mb-6 border border-gray-200 shadow-sm overflow-hidden active:opacity-95"
                  >
                    {/* Foto Copertina e Badge */}
                    <ImageBackground
                      source={{ uri: item.baseData.coverImageUrl || 'https://images.unsplash.com/photo-1514896856000-91cb6de818e0?q=80&w=800&auto=format&fit=crop' }}
                      className="w-full h-48 justify-between p-4"
                      resizeMode="cover"
                    >
                      <View className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
                      
                      {/* Top Badges */}
                      <View className="flex-row justify-between items-center relative z-10">
                        <View className="flex-row flex-wrap gap-1.5">
                          {item.collections.slice(0, 2).map((tag: string) => {
                            const colMeta = EDITORIAL_COLLECTIONS.find(c => c.id === tag);
                            return (
                              <View key={tag} className="bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/20">
                                <Typography variant="caption" className="text-white font-semibold text-[11px]">
                                  {colMeta?.title || tag}
                                </Typography>
                              </View>
                            );
                          })}
                        </View>

                        <View className="bg-white/90 backdrop-blur-md px-2.5 py-1 rounded-full flex-row items-center shadow-sm">
                          <Ionicons name="star" size={12} color="#F59E0B" />
                          <Typography variant="captionSemibold" className="text-gray-900 ml-1 text-xs font-bold">
                            {item.baseData.rating || '4.8'}
                          </Typography>
                        </View>
                      </View>

                      {/* Titolo e Categoria su Immagine */}
                      <View className="relative z-10">
                        <Typography variant="h2" className="text-white font-serif font-bold text-2xl drop-shadow-md">
                          {item.baseData.name}
                        </Typography>
                        <View className="flex-row items-center mt-1">
                          <Ionicons name={getIconForType(item.baseData.category) as any} size={14} color="#E5E7EB" />
                          <Typography variant="caption" className="text-gray-200 ml-1.5 capitalize text-xs">
                            {getCategoryDisplay(item.baseData.category).label} • {item.baseData.location?.address?.split(',')[0] || destination}
                          </Typography>
                        </View>
                      </View>
                    </ImageBackground>

                    {/* Voce del Curatore & Azioni */}
                    <View className="p-4 bg-gray-50/50">
                      <View className="bg-amber-50/80 border border-amber-200/60 p-3.5 rounded-2xl mb-4 flex-row">
                        <Typography variant="h2" className="text-amber-800 text-lg mr-2 leading-none">“</Typography>
                        <Typography variant="caption" className="text-amber-950 font-serif italic flex-1 text-sm leading-relaxed">
                          {item.editorialNote}
                        </Typography>
                      </View>

                      <View className="flex-row items-center justify-between pt-1">
                        <View className="flex-row items-center space-x-3">
                          <View className="flex-row items-center bg-gray-100 px-2.5 py-1.5 rounded-xl mr-2">
                            <Ionicons name="time-outline" size={14} color="#4B5563" />
                            <Typography variant="captionMedium" className="text-gray-700 ml-1 text-xs">
                              ~{item.recommendedDurationMinutes} min
                            </Typography>
                          </View>

                          {item.averageCost && (
                            <View className="flex-row items-center bg-gray-100 px-2.5 py-1.5 rounded-xl">
                              <Ionicons name="wallet-outline" size={14} color="#4B5563" />
                              <Typography variant="captionMedium" className="text-gray-700 ml-1 text-xs">
                                ~{item.averageCost}€
                              </Typography>
                            </View>
                          )}
                        </View>

                        {/* Pulsante rapido + Aggiungi */}
                        {(() => {
                          const btnDisplay = getButtonDisplayForPlace(item.id);
                          return (
                            <Pressable
                              onPress={(e) => {
                                e.stopPropagation();
                                if (!btnDisplay.active) {
                                  handleAddPlace(item);
                                }
                              }}
                              disabled={btnDisplay.active}
                              className={`px-4 py-2.5 rounded-2xl flex-row items-center shadow-sm ${
                                btnDisplay.active
                                  ? 'bg-green-100 border border-green-300' 
                                  : 'bg-gray-900 active:bg-gray-800'
                              }`}
                            >
                              <Ionicons 
                                name={btnDisplay.active ? "checkmark" : "add"} 
                                size={16} 
                                color={btnDisplay.active ? "#047857" : "#FFFFFF"} 
                              />
                              <Typography 
                                variant="captionSemibold" 
                                className={btnDisplay.active ? "text-green-800 font-bold ml-1 text-xs" : "text-white font-bold ml-1 text-xs"}
                              >
                                {btnDisplay.text}
                              </Typography>
                            </Pressable>
                          );
                        })()}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
              <View className="h-16" />
            </ScrollView>
          )}
        </View>
      ) : activeTab === 'cerca' ? (
        /* ===================================================================== */
        /* MODALITÀ 2: CERCA NEL MONDO (REAL PLACES ADAPTER)                     */
        /* ===================================================================== */
        <View className="flex-1">
          {/* Pulsante ricerca vicinanze */}
          <View className="px-5 py-2 flex-row items-center justify-between">
            <Pressable
              onPress={handleSearchNearby}
              className="bg-green-50 border border-green-200 px-4 py-2.5 rounded-full flex-row items-center active:bg-green-100"
            >
              <Ionicons name="location" size={16} color="#10B981" className="mr-1.5" />
              <Typography variant="captionMedium" className="text-green-800 font-semibold">
                📍 Esplora nei dintorni ({destination} 5km)
              </Typography>
            </Pressable>
            {isSearchingExternal && (
              <Typography variant="caption" className="text-gray-400 italic">
                Ricerca in corso...
              </Typography>
            )}
          </View>

          <ScrollView className="flex-1 px-5 pt-2" showsVerticalScrollIndicator={false}>
            {externalResults.length === 0 ? (
              <View className="py-16 items-center justify-center px-4">
                <View className="w-16 h-16 rounded-full bg-blue-50 items-center justify-center mb-4 border border-blue-100">
                  <Ionicons name="globe-outline" size={28} color="#3B82F6" />
                </View>
                <Typography variant="h3" className="text-gray-900 text-center font-serif mb-2">
                  Esplora il mondo reale
                </Typography>
                <Typography variant="body" className="text-gray-500 text-center mb-6 leading-relaxed">
                  Cerca luoghi reali nel dataset curato ad alta fedeltà (es. "New York Cafe", "Parlamento", "Bastione", "Torre Eiffel") o esplora i dintorni.
                </Typography>
              </View>
            ) : (
              externalResults.map((meta) => {
                // Rileva duplicati tramite PlaceMergeEngine
                const existing = savedPlaces.find(p => 
                  PlaceMergeEngine.isSamePlace(
                    { name: p.name, lat: p.coordinates?.latitude, lon: p.coordinates?.longitude },
                    { name: meta.name, lat: meta.lat, lon: meta.lon }
                  )
                );
                
                const isSaved = !!existing;
                const scheduled = existing ? isPlaceScheduled(existing.id) : isPlaceScheduled(meta.placeId);
                return (
                  <Pressable 
                    key={meta.placeId}
                    onPress={() => router.push(`/trip/${tripId}/places/${meta.placeId}` as any)}
                    className="bg-white rounded-3xl mb-5 border border-gray-100 shadow-sm overflow-hidden active:opacity-95"
                  >
                    <ImageBackground
                      source={{ uri: meta.coverImageUrl || 'https://images.unsplash.com/photo-1517840908100-89a17d7390fd?auto=format&fit=crop&w=800&q=80' }}
                      className="w-full h-44 justify-between p-4"
                      resizeMode="cover"
                    >
                      <View className="absolute inset-0 bg-black/20" />
                      <View className="flex-row justify-between items-start z-10">
                        <View className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full flex-row items-center border border-white/10">
                          <Typography variant="caption" className="text-white font-bold text-xs">
                            {`${getCategoryDisplay(meta.category).emoji} ${getCategoryDisplay(meta.category).label}`}
                          </Typography>
                        </View>
                      </View>
                      <View className="z-10">
                        <Typography variant="h3" className="text-white font-serif text-lg leading-tight">
                          {meta.name}
                        </Typography>
                        {meta.formattedAddress && (
                          <Typography variant="caption" className="text-white/90 text-xs mt-0.5">
                            {meta.formattedAddress}
                          </Typography>
                        )}
                      </View>
                    </ImageBackground>

                    <View className="p-4 flex-row items-center justify-between bg-gray-50/50">
                      <View className="flex-1 mr-3">
                        <Typography variant="caption" className="text-gray-600" numberOfLines={2}>
                          {meta.formattedAddress || 'Luogo reale verificato ad alta fedeltà.'}
                        </Typography>
                      </View>
                      {(() => {
                        const btnDisplay = getButtonDisplayForPlace(meta.placeId);
                        return (
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              if (!btnDisplay.active) {
                                handleAddExternalPlace(meta);
                              }
                            }}
                            disabled={btnDisplay.active}
                            className={`px-4 py-2.5 rounded-2xl flex-row items-center shadow-sm ${
                              btnDisplay.active
                                ? 'bg-green-100 border border-green-300' 
                                : 'bg-gray-900 active:bg-gray-800'
                            }`}
                          >
                            <Ionicons 
                              name={btnDisplay.active ? "checkmark" : "add"} 
                              size={16} 
                              color={btnDisplay.active ? "#047857" : "#FFFFFF"} 
                            />
                            <Typography 
                              variant="captionSemibold" 
                              className={btnDisplay.active ? "text-green-800 font-bold ml-1 text-xs" : "text-white font-bold ml-1 text-xs"}
                            >
                              {btnDisplay.text}
                            </Typography>
                          </Pressable>
                        );
                      })()}
                    </View>
                  </Pressable>
                );
              })
            )}
            <View className="h-16" />
          </ScrollView>
        </View>
      ) : (
        /* ===================================================================== */
        /* MODALITÀ 3: I MIEI LUOGHI (LIBRERIA SALVATA DELL'UTENTE)              */
        /* ===================================================================== */
        <View className="flex-1">
          {/* Filters */}
          <View className="mb-4">
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              {filters.map((filter) => {
                const isSelected = activeFilter === filter;
                return (
                  <Pressable
                    key={filter}
                    onPress={() => setActiveFilter(filter)}
                    className={`px-4 py-2 rounded-full mr-2 border ${
                      isSelected ? 'bg-gray-900 border-gray-900 shadow-sm' : 'bg-white border-gray-200'
                    }`}
                  >
                    <Typography
                      variant="captionMedium"
                      className={isSelected ? 'text-white font-semibold' : 'text-gray-600'}
                    >
                      {filter}
                    </Typography>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* List or Empty State */}
          <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
            {filteredPlaces.length === 0 ? (
              savedPlaces.length === 0 ? (
                <View className="py-16 items-center justify-center px-4">
                  <View className="w-16 h-16 rounded-full bg-green-50 items-center justify-center mb-4 border border-green-100">
                    <Ionicons name="sparkles" size={28} color="#10B981" />
                  </View>
                  <Typography variant="h3" className="text-gray-900 text-center font-serif mb-2">
                    La tua libreria è ancora vuota
                  </Typography>
                  <Typography variant="body" className="text-gray-500 text-center mb-6 leading-relaxed">
                    Esplora la guida editoriale o cerca nel mondo i posti migliori per aggiungerli al tuo itinerario.
                  </Typography>
                  <Pressable
                    onPress={() => setActiveTab('consigliati')}
                    className="bg-gray-900 px-6 py-3.5 rounded-2xl flex-row items-center shadow-md active:bg-gray-800"
                  >
                    <Ionicons name="sparkles" size={16} color="#FFFFFF" className="mr-2" />
                    <Typography variant="bodySemibold" className="text-white font-bold">
                      ✨ Esplora i Consigliati
                    </Typography>
                  </Pressable>
                </View>
              ) : (
                <View className="py-12 items-center justify-center">
                  <Ionicons name="search" size={36} color="#D1D5DB" className="mb-3" />
                  <Typography variant="bodySemibold" className="text-gray-700 text-center">Nessun luogo trovato</Typography>
                  <Typography variant="caption" className="text-gray-400 text-center mt-1">
                    Prova a cambiare i filtri o la ricerca per "{searchQuery}".
                  </Typography>
                </View>
              )
            ) : (
              <View className="flex-row flex-wrap justify-between">
                {filteredPlaces.map((place) => (
                  <Pressable 
                    key={place.id}
                    onPress={() => router.push(`/trip/${tripId}/places/${place.id}` as any)}
                    className="w-[48%] h-64 bg-gray-100 mb-4 overflow-hidden shadow-sm active:opacity-80 relative"
                    style={{ borderRadius: radius.xl }}
                  >
                  <ImageBackground
                    source={{ uri: place.coverImageUrl || 'https://images.unsplash.com/photo-1514896856000-91cb6de818e0?q=80&w=600&auto=format&fit=crop' }}
                    className="w-full h-full justify-end"
                    resizeMode="cover"
                  >
                    <View className="absolute inset-0 bg-black/20" />
                    <View className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
                    
                    {/* Star Badge (Must See) */}
                    {place.priority === 'must_see' && (
                      <View className="absolute top-3 left-3 w-6 h-6 rounded-full bg-white/20 backdrop-blur-md items-center justify-center border border-white/10">
                        <Typography variant="caption" className="text-white text-[10px]">⭐</Typography>
                      </View>
                    )}

                    {/* Visited Badge */}
                    {place.isVisited && (
                      <View className={`absolute top-3 rounded-full bg-green-500/80 backdrop-blur-md flex-row items-center px-2 py-0.5 ${place.priority === 'must_see' ? 'left-11' : 'left-3'}`}>
                        <Ionicons name="checkmark-circle" size={12} color="#FFFFFF" />
                        <Typography variant="caption" className="text-white ml-1 text-[10px]">Visitato</Typography>
                      </View>
                    )}

                    {/* Unsave Button */}
                    <Pressable
                      onPress={async (e) => {
                        e.stopPropagation();
                        await actions.assignPlaceToDay(tripId, undefined, place);
                        await actions.removePlace(tripId, place.id);
                      }}
                      className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/40 backdrop-blur-md items-center justify-center border border-white/20 active:bg-red-500 z-50"
                    >
                      <Ionicons name="heart" size={14} color="#EF4444" />
                    </Pressable>
                    
                    {/* Content */}
                    <View className="p-4 relative z-10">
                      <View className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-md items-center justify-center mb-2 border border-white/20">
                        <Ionicons name={getIconForType(place.category) as any} size={14} color="#FFFFFF" />
                      </View>
                      <Typography variant="bodySemibold" className="text-white text-base leading-tight mb-1" numberOfLines={2}>
                        {place.name}
                      </Typography>
                      <Typography variant="caption" className="text-white/80 capitalize">
                        {place.category}
                      </Typography>
                    </View>
                  </ImageBackground>
                  </Pressable>
                ))}
              </View>
            )}
            <View className="h-16" />
          </ScrollView>
        </View>
      )}
    </SafeAreaView>
  );
}
