import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Animated, ImageBackground, Pressable, StatusBar, Dimensions, Easing, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../../src/shared/components/Typography';
import { TextField } from '../../../../src/shared/components/forms/TextField';
import { usePlaces, usePlaceDetails, useTravelContext, useTravelActions, useTimeline } from '../../../../src/shared/hooks';
import { calculateHaversineDistance, formatDistance } from '../../../../src/shared/utils/distance.utils';

const { width } = Dimensions.get('window');
const HEADER_HEIGHT = 450;

const FadeInView = ({ children, delay = 0, style }: any) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic)
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 400,
        delay,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic)
      })
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY }], ...style }}>
      {children}
    </Animated.View>
  );
};

/**
 * ============================================================================
 * PLACE DETAIL SCREEN (DETTAGLIO LUOGO E CHECK-IN REATTIVO)
 * ============================================================================
 * Conforme alla Regola d'Oro: legge e modifica lo stato tramite usePlaces,
 * useTravelContext e useTravelActions.
 */
export default function PlaceDetailScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ id: string | string[]; placeId: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ id: string | string[]; placeId: string | string[] }>();
  const idParam = localParams.id || globalParams.id;
  const placeIdParam = localParams.placeId || globalParams.placeId;
  const tripId = (Array.isArray(idParam) ? idParam[0] : idParam) || 'trip-budapest-2026';
  const cleanPlaceId = (Array.isArray(placeIdParam) ? placeIdParam[0] : placeIdParam) || '';
  
  const context = useTravelContext(tripId);
  const { savedPlaces } = usePlaces(tripId);
  const { days } = useTimeline(tripId);
  const actions = useTravelActions();
  
  const scrollY = useRef(new Animated.Value(0)).current;

  // ADR-017 §5.2/§5.4: la UI legge il luogo esclusivamente tramite hook —
  // mai un import diretto di PlaceRepository/Place/PlaceMetadata/TravelPlace.
  // usePlaceDetails copre sia i luoghi già salvati (usePlaces) sia quelli
  // non ancora salvati (ricerca live, catalogo editoriale) tramite la
  // pipeline transiente Provider → Canonical → PlaceRef, mai persistita.
  const { place, resolvedPlace, loading } = usePlaceDetails(tripId, cleanPlaceId);

  const isAlreadySaved = useMemo(() => {
    return place ? savedPlaces.some((p) => p.id === place.id) : false;
  }, [savedPlaces, place]);

  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    if (place) {
      setNoteText(place.notes || '');
    }
  }, [place]);

  const currentAssignedDay = useMemo(() => {
    if (!place || !days) return undefined;
    const day = days.find(d => d.places.some(p => p.id === place.id));
    return day?.dayNumber;
  }, [days, place]);

  const nearbyPlaces = useMemo(() => {
    if (!place?.coordinates || !savedPlaces.length) return [];
    const { latitude: lat1, longitude: lon1 } = place.coordinates;
    
    return savedPlaces
      .filter(p => p.id !== place.id && p.coordinates)
      .map(p => {
        const { latitude: lat2, longitude: lon2 } = p.coordinates;
        const distance = calculateHaversineDistance(lat1, lon1, lat2, lon2);
        return { place: p, distance };
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [place, savedPlaces]);

  if (loading) {
    return (
      <View className="flex-1 bg-[#FAF9F6] items-center justify-center">
        <Typography variant="body" className="text-gray-500">Caricamento dettagli luogo...</Typography>
      </View>
    );
  }

  if (!place) {
    return (
      <View className="flex-1 bg-[#FAF9F6] items-center justify-center">
        <Typography variant="body" className="text-gray-500">Luogo non trovato o errore di connessione.</Typography>
      </View>
    );
  }

  const tripStatus = context.tripPhase; 

  const renderQuickActions = () => {
    const actionsList: Array<{ icon: string, label: string, color?: string, bg?: string, onPress?: () => void }> = [];
    
    // Tasto Salva / Preferito reattivo (mostrato SOLO se non è già salvato)
    if (!isAlreadySaved) {
      actionsList.push({
        icon: 'heart',
        label: 'Salva ❤️',
        color: '#EF4444',
        bg: '#FEE2E2',
        onPress: () => {
          actions.savePlace(tripId, place);
        }
      });
    } else {
      actionsList.push({
        icon: 'heart-dislike',
        label: 'Rimuovi 💔',
        color: '#EF4444',
        bg: '#FEE2E2',
        onPress: async () => {
          await actions.assignPlaceToDay(tripId, undefined, place);
          await actions.removePlace(tripId, place.id);
          router.back();
        }
      });
    }

    if (place.coordinates) {
      actionsList.push({ icon: 'navigate-outline', label: 'Naviga' });
    }
    actionsList.push({ icon: 'call-outline', label: 'Chiama' });
    if (place.category === 'restaurant') {
      actionsList.push({ icon: 'restaurant-outline', label: 'Menu' });
    }
    actionsList.push({ icon: 'ticket-outline', label: 'Biglietti' });

    // Tasto Check-in / Segna come visitato reattivo (con toggle!)
    if (!place.isVisited) {
      actionsList.push({ 
        icon: 'checkmark-circle-outline', 
        label: 'Check-in',
        color: '#FFFFFF',
        bg: '#10B981',
        onPress: () => {
          actions.markAsVisited(tripId, place.id, true);
        }
      });
    } else {
      actionsList.push({ 
        icon: 'checkmark-done-circle', 
        label: 'Visitato ✓',
        color: '#FFFFFF',
        bg: '#6B7280',
        onPress: () => {
          actions.markAsVisited(tripId, place.id, false);
        }
      });
    }

    return (
      <View className="flex-row flex-wrap justify-start gap-x-3 gap-y-4 px-2 mb-10">
        {actionsList.map((action, i) => (
          <View key={i} className="items-center w-16">
            <Pressable 
              onPress={action.onPress}
              style={({ pressed }) => ({
                backgroundColor: action.bg || '#F3F4F6',
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.95 : 1 }]
              })}
              className="w-14 h-14 rounded-full items-center justify-center mb-2 shadow-sm"
            >
              <Ionicons name={action.icon as any} size={24} color={action.color || "#1C1C1E"} />
            </Pressable>
            <Typography variant="captionMedium" className="text-gray-600 text-center" numberOfLines={1}>{action.label}</Typography>
          </View>
        ))}
      </View>
    );
  };

  const renderLiveContext = () => {
    const ratingStr = place.rating ? `★ ${place.rating}` : '★ 4.8';
    let contextString = '';

    if (place.isVisited) {
      contextString = `${ratingStr} • ✓ Visitato con successo`;
    } else if (tripStatus === 'planned') {
      contextString = `${ratingStr} • 📅 In programma • 🕒 60 min stimati`;
    } else if (tripStatus === 'ongoing') {
      contextString = `${ratingStr} • 🟢 Aperto adesso • 🚶 350m da te`;
    } else {
      contextString = `${ratingStr} • ⏳ Tappa di viaggio`;
    }

    return (
      <Typography variant="bodySemibold" className="text-white/90">
        {contextString}
      </Typography>
    );
  };

  const headerTranslateY = scrollY.interpolate({
    inputRange: [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
    outputRange: [-HEADER_HEIGHT / 2, 0, HEADER_HEIGHT * 0.5],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [-HEADER_HEIGHT, 0, HEADER_HEIGHT],
    outputRange: [2, 1, 1],
    extrapolate: 'clamp',
  });

  return (
    <View className="flex-1 bg-[#FAF9F6]">
      <StatusBar barStyle="light-content" />
      
      <Animated.View 
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_HEIGHT,
          transform: [{ translateY: headerTranslateY }, { scale: headerScale }]
        }}
      >
        <ImageBackground
          source={{ uri: place.coverImageUrl || 'https://images.unsplash.com/photo-1514896856000-91cb6de818e0?q=80&w=1200&auto=format&fit=crop' }}
          className="w-full h-full"
          resizeMode="cover"
        >
          <View className="absolute inset-0 bg-black/10" />
          <View className="absolute bottom-0 left-0 right-0 h-56 bg-gradient-to-t from-black via-black/60 to-transparent" />
        </ImageBackground>
      </Animated.View>
 
      <Animated.ScrollView 
        className="flex-1"
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        <View style={{ height: HEADER_HEIGHT - 40 }}>
          <View className="absolute top-14 left-4 right-4 flex-row justify-between items-center z-50">
            <Pressable 
              onPress={() => router.back()}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
                transform: [{ scale: pressed ? 0.9 : 1 }]
              })}
              className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md items-center justify-center border border-white/20"
            >
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>
            <View className="flex-row items-center gap-2">
              <Pressable 
                onPress={async () => {
                  if (isAlreadySaved) {
                    await actions.assignPlaceToDay(tripId, undefined, place);
                    await actions.removePlace(tripId, place.id);
                    router.back();
                  } else {
                    actions.savePlace(tripId, place);
                  }
                }}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.9 : 1 }]
                })}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md items-center justify-center border border-white/20"
              >
                <Ionicons name={isAlreadySaved ? "heart" : "heart-outline"} size={20} color={isAlreadySaved ? "#EF4444" : "#FFFFFF"} />
              </Pressable>
              <Pressable 
                onPress={() => router.back()}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.9 : 1 }]
                })}
                className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md items-center justify-center border border-white/20"
              >
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View className="absolute bottom-10 left-6 right-6">
            <View className="flex-row items-center gap-2 mb-1">
              <Typography variant="caption" className="text-white/80 uppercase tracking-widest font-medium">
                {place.category}
              </Typography>
              {resolvedPlace?.source && resolvedPlace.source !== 'saved' && (
                <View className="bg-blue-600/90 backdrop-blur-md px-2.5 py-0.5 rounded-full flex-row items-center">
                  <Ionicons name="cloud-done" size={10} color="#FFFFFF" />
                  <Typography variant="caption" className="text-white font-bold ml-1 text-[10px] capitalize">
                    {resolvedPlace.source}
                  </Typography>
                </View>
              )}
            </View>
            <Typography variant="h1" className="text-white text-4xl font-bold tracking-tight mb-3">
              {place.name}
            </Typography>
            {renderLiveContext()}
          </View>
        </View>

        <View className="px-6 py-8 bg-[#FAF9F6]" style={{ borderTopLeftRadius: 32, borderTopRightRadius: 32 }}>
          
          <FadeInView delay={0}>
            {renderQuickActions()}
          </FadeInView>

          {/* Day Selector (Programmazione Tappa) */}
          {place && isAlreadySaved && (
            <FadeInView delay={50}>
              <View className="mb-8 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <Typography variant="h3" className="mb-3 font-serif">Programmazione Tappa</Typography>
                <Typography variant="caption" className="text-gray-400 uppercase tracking-wider text-[11px] mb-3 block">
                  Seleziona il giorno in cui pianificare questa visita:
                </Typography>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
                >
                  <Pressable
                    onPress={async () => {
                      await actions.assignPlaceToDay(tripId, undefined, place);
                    }}
                    className={`px-4 py-2.5 rounded-xl border ${
                      currentAssignedDay === undefined 
                        ? 'bg-gray-900 border-gray-900 shadow-sm' 
                        : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                    }`}
                  >
                    <Typography variant="bodySemibold" className={`text-xs ${currentAssignedDay === undefined ? 'text-white' : 'text-gray-700'}`}>
                      📚 Solo in Libreria
                    </Typography>
                  </Pressable>
                  
                  {days?.map((day) => {
                    const isSelected = currentAssignedDay === day.dayNumber;
                    return (
                      <Pressable
                        key={day.dayNumber}
                        onPress={async () => {
                          await actions.assignPlaceToDay(tripId, undefined, place);
                          await actions.assignPlaceToDay(tripId, day.dayNumber, place);
                        }}
                        className={`px-4 py-2.5 rounded-xl border ${
                          isSelected 
                            ? 'bg-[#4A6741] border-[#4A6741] shadow-sm' 
                            : 'bg-gray-50 border-gray-200 active:bg-gray-100'
                        }`}
                      >
                        <Typography variant="bodySemibold" className={`text-xs ${isSelected ? 'text-white' : 'text-gray-700'}`}>
                          📅 Giorno {day.dayNumber}
                        </Typography>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            </FadeInView>
          )}

          <FadeInView delay={100}>
            <View className="mb-10">
              <Typography variant="h3" className="mb-4">Informazioni Pratiche & Dati</Typography>
              <View className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                {place.address && (
                  <View className="flex-row items-start">
                    <Ionicons name="location-outline" size={20} color="#4B5563" className="mr-3 mt-0.5" />
                    <View className="flex-1">
                      <Typography variant="captionMedium" className="text-gray-400 uppercase text-[11px]">Indirizzo</Typography>
                      <Typography variant="bodySemibold" className="text-gray-700">{place.address}</Typography>
                    </View>
                  </View>
                )}

                <View className="flex-row items-start">
                  <Ionicons name="time-outline" size={20} color="#4B5563" className="mr-3 mt-0.5" />
                  <View className="flex-1">
                    <Typography variant="captionMedium" className="text-gray-400 uppercase text-[11px]">Durata Stimata</Typography>
                    <Typography variant="bodySemibold" className="text-gray-700">
                      {place.durationMinutes ? `${place.durationMinutes} minuti` : 'Orari non disponibili'}
                    </Typography>
                  </View>
                </View>

                <View className="w-full h-px bg-gray-100 my-2" />

                {/* 3-Layer Architecture Badge / Box */}
                <View className="bg-gray-50 rounded-xl p-3.5 border border-gray-200/60">
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="layers" size={16} color="#3B82F6" />
                    <Typography variant="captionSemibold" className="text-blue-900 ml-1.5 uppercase tracking-wide text-xs">
                      Place Intelligence (3-Layer)
                    </Typography>
                  </View>
                  
                  <View className="space-y-1.5">
                    <View className="flex-row items-center justify-between">
                      <Typography variant="caption" className="text-gray-500">Sorgente Dati (Base):</Typography>
                      <Typography variant="captionMedium" className="text-gray-800 capitalize">
                        {resolvedPlace?.source || 'Catalogo Travel OS'}
                      </Typography>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Typography variant="caption" className="text-gray-500">Livello Editoriale:</Typography>
                      <Typography variant="captionMedium" className="text-green-700">
                        {(place as any).priority === 'must_see' ? '⭐ Must See' : '✨ Consigliato'}
                      </Typography>
                    </View>
                    <View className="flex-row items-center justify-between">
                      <Typography variant="caption" className="text-gray-500">Livello Personale:</Typography>
                      <Typography variant="captionMedium" className={place.isVisited ? "text-green-600" : "text-amber-600"}>
                        {place.isVisited ? '✓ Visitato' : '⏳ In Lista'}
                      </Typography>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </FadeInView>

          <FadeInView delay={200}>
            <View className="mb-10">
              <View className="flex-row justify-between items-center mb-4">
                <Typography variant="h3">Note & Consigli</Typography>
                <Pressable onPress={() => setIsEditingNote(!isEditingNote)}>
                  <Typography variant="bodySemibold" className="text-blue-600 text-sm">
                    {isEditingNote ? 'Annulla' : (place.notes ? 'Modifica' : 'Aggiungi')}
                  </Typography>
                </Pressable>
              </View>
              {isEditingNote ? (
                <View className="mb-3">
                  <TextField
                    multiline
                    value={noteText}
                    onChangeText={setNoteText}
                    placeholder="Scrivi qui i tuoi appunti, consigli o ricordi di questo luogo..."
                    autoFocus
                    containerClassName="mb-3 animate-fade-in"
                    inputClassName="font-serif text-[17px] leading-relaxed"
                  />
                  <Pressable 
                    onPress={() => {
                      actions.updatePlaceNotes(tripId, place.id, noteText);
                      setIsEditingNote(false);
                    }}
                    className="bg-blue-600 rounded-xl py-2.5 items-center justify-center"
                  >
                    <Typography variant="bodySemibold" className="text-white">Salva Nota</Typography>
                  </Pressable>
                </View>
              ) : (
                <View className="rounded-2xl p-5 border mb-3 bg-[#f2f0e9] border-[#e5e3dc]">
                  <View className="flex-row items-center mb-2">
                    <Ionicons name="document-text" size={16} color="#6B7280" />
                    <Typography variant="captionMedium" className="text-gray-500 ml-2 uppercase tracking-wide">
                      Nota Personale
                    </Typography>
                  </View>
                  <Typography variant="body" className="text-gray-800 leading-relaxed font-serif text-[17px]">
                    {place.notes || 'Nessuna nota presente per questo luogo. Clicca su Aggiungi per creare il tuo primo appunto.'}
                  </Typography>
                </View>
              )}
            </View>
          </FadeInView>

          <FadeInView delay={300}>
            {nearbyPlaces.length > 0 && (
              <View className="mb-10 -mx-6">
                <Typography variant="h3" className="mb-4 px-6">Vicino trovi anche</Typography>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
                >
                  {nearbyPlaces.map(({ place, distance }) => (
                    <Pressable 
                       key={place.id}
                      onPress={() => router.push(`/trip/${tripId}/places/${place.id}` as any)}
                      className="w-60 bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm active:bg-gray-50 flex-row items-center pr-3"
                    >
                      <ImageBackground source={{ uri: place.coverImageUrl || 'https://via.placeholder.com/100' }} className="w-20 h-24" />
                      <View className="flex-1 p-3 pl-4">
                        <View className="flex-row justify-between items-center mb-1">
                          <Typography variant="captionMedium" className="text-blue-600">{formatDistance(distance)}</Typography>
                          {place.priority === 'must_see' && <Typography variant="caption">⭐</Typography>}
                        </View>
                        <Typography variant="bodySemibold" className="text-gray-900 leading-tight" numberOfLines={2}>{place.name}</Typography>
                        <Typography variant="caption" className="text-gray-500 mt-1 capitalize">{place.category}</Typography>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
          </FadeInView>

          <FadeInView delay={400}>
            <View className="mb-10">
              <Typography variant="h3" className="mb-4">Il tuo Diario</Typography>
              
              {place.isVisited ? (
                <View className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5 -mx-1">
                    {[1, 2, 3].map((img, idx) => (
                      <View key={idx} className="w-24 h-24 bg-gray-200 rounded-xl mx-1 overflow-hidden">
                        <ImageBackground source={{ uri: place.coverImageUrl || 'https://via.placeholder.com/300' }} className="w-full h-full opacity-80" />
                      </View>
                    ))}
                    <View className="w-24 h-24 bg-gray-50 border border-gray-200 rounded-xl mx-1 items-center justify-center">
                      <Typography variant="captionMedium" className="text-gray-500">+12 foto</Typography>
                    </View>
                  </ScrollView>

                  <Typography variant="body" className="text-gray-800 leading-relaxed font-serif text-lg mb-4 italic">
                    "Un'esperienza fantastica, luogo segnato come visitato nel Context Engine!"
                  </Typography>
                </View>
              ) : (
                <View className="bg-gray-50 border border-gray-100 border-dashed rounded-2xl p-8 items-center justify-center">
                  <Ionicons name="book-outline" size={32} color="#D1D5DB" className="mb-2" />
                  <Typography variant="body" className="text-gray-500 text-center">
                    Il tuo diario si sbloccherà dopo il check-in o la visita.
                  </Typography>
                </View>
              )}
            </View>
          </FadeInView>

        </View>
        <View className="h-20" />
      </Animated.ScrollView>
    </View>
  );
}
