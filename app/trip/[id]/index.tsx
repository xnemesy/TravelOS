import React, { useState, useEffect } from 'react';
import { View, StatusBar, Pressable, ScrollView, ImageBackground, Modal, Alert, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, withSpring, withTiming, useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../src/shared/components/Typography';
import { useTravelContext, useNextPlace, usePlaces, useTravelActions } from '../../../src/shared/hooks';
import { useTripStore } from '../../../src/features/trips/store/trip.store';
import { SavedPlacesLibrary } from '../../../src/features/itinerary/components/SavedPlacesLibrary';
import { TimelinePreview } from '../../../src/features/itinerary/components/TimelinePreview';
import { formatDistance } from '../../../src/shared/utils/distance.utils';
import { hydrateContext } from '../../../src/core/engines';
import { usePlannerStore } from '../../../src/features/itinerary/store/planner.store';

// ==============================================
// SOTTO-COMPONENTI PER LE 3 FASI DEL VIAGGIO
// ==============================================

const PlanningDashboard = ({ tripId }: { tripId: string }) => {
  const [activeTab, setActiveTab] = useState<'planner' | 'library'>('planner');
  const router = useRouter();
  
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      {/* Search Bar - Punto di ingresso per catalogo e ricerca */}
      <Pressable 
        onPress={() => router.push(`/trip/${tripId}/places` as any)}
        className="bg-gray-100 rounded-2xl flex-row items-center p-4 mb-5 active:opacity-70"
      >
        <Ionicons name="search" size={20} color="#9CA3AF" />
        <Typography variant="body" className="text-gray-500 ml-3">Cerca o esplora luoghi salvati...</Typography>
      </Pressable>

      {/* Toggle Tab tra Planner Giornaliero e Libreria */}
      <View className="flex-row bg-gray-100 p-1 rounded-2xl mb-5">
        <Pressable
          onPress={() => setActiveTab('planner')}
          className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
            activeTab === 'planner' ? 'bg-white shadow-sm' : ''
          }`}
        >
          <Ionicons name="calendar" size={16} color={activeTab === 'planner' ? '#1C1C1E' : '#6B7280'} />
          <Typography variant="captionSemibold" className={`ml-2 ${activeTab === 'planner' ? 'text-gray-900' : 'text-gray-600'}`}>
            Planner Giornaliero
          </Typography>
        </Pressable>

        <Pressable
          onPress={() => setActiveTab('library')}
          className={`flex-1 py-2.5 rounded-xl items-center flex-row justify-center ${
            activeTab === 'library' ? 'bg-white shadow-sm' : ''
          }`}
        >
          <Ionicons name="bookmark" size={16} color={activeTab === 'library' ? '#1C1C1E' : '#6B7280'} />
          <Typography variant="captionSemibold" className={`ml-2 ${activeTab === 'library' ? 'text-gray-900' : 'text-gray-600'}`}>
            Libreria (Salvati)
          </Typography>
        </Pressable>
      </View>

      {/* Render dinamico del motore del Planner (Timeline vs Libreria) */}
      {activeTab === 'planner' ? (
        <TimelinePreview tripId={tripId} />
      ) : (
        <SavedPlacesLibrary tripId={tripId} />
      )}
    </ScrollView>
  );
};

const JourneyDashboard = ({ tripId }: { tripId: string }) => {
  const router = useRouter();
  const { currentOrNextPlace } = useNextPlace(tripId);
  const actions = useTravelActions();

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <View className="bg-green-50 rounded-2xl p-4 mb-6 flex-row items-center border border-green-100">
        <Ionicons name="navigate-circle" size={32} color="#10B981" />
        <View className="ml-3 flex-1">
          <Typography variant="bodySemibold" className="text-green-900">In Viaggio!</Typography>
          <Typography variant="captionMedium" className="text-green-700">Modalità live attiva nel Context Engine</Typography>
        </View>
        <Pressable 
          onPress={() => router.push(`/trip/${tripId}/today` as any)}
          className="bg-green-600 px-3 py-1.5 rounded-xl"
        >
          <Typography variant="captionSemibold" className="text-white">Apri Today</Typography>
        </Pressable>
      </View>

      <Typography variant="h3" className="mb-4">Prossima Tappa in Programma</Typography>
      
      {!currentOrNextPlace ? (
        <View className="bg-white rounded-3xl p-8 border border-gray-100 items-center justify-center">
          <Ionicons name="checkmark-done-circle" size={48} color="#10B981" className="mb-2" />
          <Typography variant="bodySemibold" className="text-gray-800">Nessuna tappa imminente</Typography>
          <Typography variant="caption" className="text-gray-500 text-center mt-1">
            Hai completato le tappe pianificate per oggi!
          </Typography>
        </View>
      ) : (
        <Pressable 
          onPress={() => router.push(`/trip/${tripId}/places/${currentOrNextPlace.id}` as any)}
          className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100 mb-8 active:opacity-90"
        >
          <ImageBackground 
            source={{ uri: currentOrNextPlace.coverImageUrl || 'https://images.unsplash.com/photo-1549877452-9c387954fbc2?q=80&w=800&auto=format&fit=crop' }}
            className="h-44 bg-gray-200 justify-end"
          >
            <View className="absolute inset-0 bg-black/20" />
            <View className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/80 to-transparent" />
            <View className="p-4 relative z-10">
              <Typography variant="captionMedium" color="inverse" className="text-sky-300 mb-1">
                {(currentOrNextPlace.estimatedWalkMinutes && currentOrNextPlace.estimatedWalkMinutes > 0) 
                  ? `Tra ${currentOrNextPlace.estimatedWalkMinutes} min a piedi (${formatDistance(currentOrNextPlace.distanceMeters || 0)})` 
                  : '📍 Punto di partenza della giornata (Tappa attuale)'}
              </Typography>
              <Typography variant="h2" color="inverse" className="text-white text-xl font-bold" numberOfLines={1}>
                {currentOrNextPlace.name}
              </Typography>
            </View>
          </ImageBackground>

          <View className="p-4 flex-row gap-2">
            <Pressable 
              onPress={() => actions.markAsVisited(tripId, currentOrNextPlace.id)}
              className="flex-[2] bg-green-600 rounded-xl py-3 items-center justify-center flex-row shadow-sm"
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" className="mr-1.5" />
              <Typography variant="bodySemibold" className="text-white">Check-in / Visitato</Typography>
            </Pressable>
            
            <Pressable 
              onPress={() => router.push(`/trip/${tripId}/places/${currentOrNextPlace.id}` as any)}
              className="flex-1 bg-gray-100 rounded-xl py-3 items-center justify-center"
            >
              <Typography variant="bodySemibold" className="text-gray-900">Dettaglio</Typography>
            </Pressable>
          </View>
        </Pressable>
      )}
    </ScrollView>
  );
};

const MemoriesDashboard = ({ tripId }: { tripId: string }) => {
  const router = useRouter();
  const { visitedPlaces, visitedPlacesCount } = usePlaces(tripId);

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <View className="items-center py-6">
        <Typography variant="h1" className="text-gray-900 mb-2">Bentornato</Typography>
        <Typography variant="body" className="text-gray-500 text-center">
          Il tuo viaggio è archiviato. Ecco i ricordi generati dal Context Engine.
        </Typography>
      </View>

      <View className="flex-row gap-3 mb-8">
        <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 items-center">
          <Ionicons name="checkmark-circle" size={24} color="#10B981" className="mb-2" />
          <Typography variant="h3" className="text-gray-900">{visitedPlacesCount}</Typography>
          <Typography variant="caption" className="text-gray-500">Luoghi Visitati</Typography>
        </View>
        <View className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-gray-100 items-center">
          <Ionicons name="camera" size={24} color="#3B82F6" className="mb-2" />
          <Typography variant="h3" className="text-gray-900">{visitedPlacesCount * 12}</Typography>
          <Typography variant="caption" className="text-gray-500">Foto & Note</Typography>
        </View>
      </View>

      <Typography variant="h3" className="mb-4">Il tuo Diario ({visitedPlaces.length})</Typography>
      
      {visitedPlaces.length > 0 ? (
        <View className="mb-8">
          {visitedPlaces.map((place) => (
            <Pressable 
              key={place.id}
              onPress={() => router.push(`/trip/${tripId}/places/${place.id}` as any)}
              className="flex-row bg-white rounded-2xl p-3 mb-4 shadow-sm border border-gray-100 active:opacity-80"
            >
              <ImageBackground 
                source={{ uri: place.coverImageUrl || 'https://via.placeholder.com/150' }}
                className="w-20 h-20 rounded-xl overflow-hidden"
                resizeMode="cover"
              />
              <View className="flex-1 ml-4 justify-center">
                <View className="flex-row justify-between items-center mb-1">
                  <Typography variant="captionMedium" className="text-gray-500 capitalize">
                    {place.category}
                  </Typography>
                  <View className="flex-row items-center">
                    <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                    <Typography variant="caption" className="text-green-700 ml-1">Visitato</Typography>
                  </View>
                </View>
                <Typography variant="bodySemibold" className="text-gray-900 mb-1" numberOfLines={1}>
                  {place.name}
                </Typography>
                <Typography variant="caption" className="text-gray-500" numberOfLines={1}>
                  {place.notes ? `"${place.notes}"` : 'Nessuna nota nel diario.'}
                </Typography>
              </View>
              <View className="justify-center pl-2">
                <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View className="bg-gray-50 border border-gray-100 rounded-2xl p-8 items-center justify-center mb-8">
          <Ionicons name="book" size={32} color="#D1D5DB" className="mb-2" />
          <Typography variant="body" className="text-gray-500 text-center">
            Segna i luoghi come visitati con il tasto Check-in per sbloccare il tuo diario qui.
          </Typography>
        </View>
      )}
    </ScrollView>
  );
};

// ==============================================
// COMPONENTE PRINCIPALE (SWITCH DINAMICO)
// ==============================================

export default function TripHomeScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ id: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ id: string | string[] }>();
  const idParam = localParams.id || globalParams.id;
  const tripId = (Array.isArray(idParam) ? idParam[0] : idParam) || 'trip-budapest-2026';

  const context = useTravelContext(tripId);
  const { duplicateTrip, archiveTrip, deleteTrip } = useTripStore();
  const [overrideStatus, setOverrideStatus] = useState<'planned' | 'ongoing' | 'completed' | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isFabOpen, setIsFabOpen] = useState(false);

  const fabRotation = useSharedValue(0);
  const fabMenuOpacity = useSharedValue(0);
  const fabMenuTranslateY = useSharedValue(20);

  const toggleFab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isFabOpen) {
      fabRotation.value = withSpring(0);
      fabMenuOpacity.value = withTiming(0, { duration: 200 });
      fabMenuTranslateY.value = withTiming(20, { duration: 200 });
      setTimeout(() => setIsFabOpen(false), 200);
    } else {
      setIsFabOpen(true);
      fabRotation.value = withSpring(45);
      fabMenuOpacity.value = withTiming(1, { duration: 200 });
      fabMenuTranslateY.value = withSpring(0);
    }
  };

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${fabRotation.value}deg` }]
  }));

  const fabMenuAnimatedStyle = useAnimatedStyle(() => ({
    opacity: fabMenuOpacity.value,
    transform: [{ translateY: fabMenuTranslateY.value }],
    display: fabMenuOpacity.value === 0 && !isFabOpen ? 'none' : 'flex'
  }));

  useEffect(() => {
    hydrateContext(tripId).then(() => {
      setIsHydrating(false);
    });
  }, [tripId]);

  const currentStatus = overrideStatus || context.tripPhase || 'planned';
  const tripTitle = context.tripTitle || 'Dettaglio Viaggio';

  // Seleziona la dashboard in base allo stato
  const renderDashboard = () => {
    switch (currentStatus) {
      case 'planned': return <PlanningDashboard tripId={tripId} />;
      case 'ongoing': return <JourneyDashboard tripId={tripId} />;
      case 'completed': return <MemoriesDashboard tripId={tripId} />;
      default: return <PlanningDashboard tripId={tripId} />;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FAF9F6' }}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header Globale */}
      <View className="px-5 py-2 flex-row items-center justify-between border-b border-gray-100 pb-3">
        <Pressable onPress={() => router.push('/')} className="flex-row items-center">
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
          <Typography variant="bodySemibold" className="text-gray-900 ml-1">Home</Typography>
        </Pressable>
        <Pressable 
          onPress={() => setShowMenu(true)}
          className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center active:bg-gray-200"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#1C1C1E" />
        </Pressable>
      </View>

      <View className="px-5 pt-3 mb-2">
        <Typography variant="h1" className="text-gray-900 text-3xl font-bold tracking-tight">
          {tripTitle}
        </Typography>

        {/* Journey Score Progress Bar */}
        {currentStatus === 'planned' && (
          <View className="mt-4 mb-2">
            <View className="flex-row justify-between items-end mb-1.5">
              <Typography variant="captionSemibold" className="text-gray-500 uppercase tracking-wider text-[10px]">
                Stato Organizzazione
              </Typography>
              <Typography variant="bodySemibold" className="text-gray-900">
                {`${context.timeline?.days?.filter((d: any) => d.places?.length > 0).length || 0} di ${context.totalDays || 1} giornate organizzate`}
              </Typography>
            </View>
            <View className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
              <View 
                className="h-full bg-gray-900 rounded-full" 
                style={{ width: `${context.journeyScore || 0}%` }}
              />
            </View>
          </View>
        )}

        {/* Phase Switcher: ti permette di consultare o pianificare il viaggio in qualsiasi momento */}
        <View className="flex-row gap-2 mt-2.5 mb-1">
          {[
            { id: 'planned', label: 'Pianificazione', icon: 'calendar-outline' },
            { id: 'ongoing', label: 'In viaggio', icon: 'navigate-outline' },
            { id: 'completed', label: 'Diario', icon: 'book-outline' },
          ].map((phase) => {
            const isActive = currentStatus === phase.id;
            return (
              <Pressable
                key={phase.id}
                onPress={() => setOverrideStatus(phase.id as any)}
                className={`px-3 py-1.5 rounded-full flex-row items-center border ${
                  isActive 
                    ? 'bg-gray-900 border-gray-900' 
                    : 'bg-white border-gray-200'
                }`}
              >
                <Ionicons 
                  name={phase.icon as any} 
                  size={12} 
                  color={isActive ? '#FFFFFF' : '#6B7280'} 
                />
                <Typography 
                  variant="captionSemibold" 
                  className={`ml-1.5 ${isActive ? 'text-white' : 'text-gray-600'}`}
                >
                  {phase.label}
                </Typography>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Rende dinamicamente la dashboard corretta garantendo flex: 1 */}
      <View style={{ flex: 1, opacity: isHydrating ? 0.5 : 1 }}>
        {renderDashboard()}
      </View>

      {/* SMART FAB */}
      {currentStatus === 'planned' && (
        <View className="absolute bottom-10 right-5 items-end z-50">
          {isFabOpen && (
            <Pressable 
              className="absolute -top-[1000px] -left-[1000px] -right-[1000px] -bottom-[1000px]" 
              onPress={toggleFab} 
            />
          )}
          
          <Animated.View style={fabMenuAnimatedStyle} className="mb-4 items-end">
            <Pressable 
              onPress={() => {
                toggleFab();
                router.push(`/trip/${tripId}/places` as any);
              }}
              className="bg-white px-4 py-2.5 rounded-full shadow-lg border border-gray-100 flex-row items-center mb-2"
            >
              <Typography variant="bodySemibold" className="text-gray-900 mr-2">Esplora Luoghi</Typography>
              <View className="w-8 h-8 rounded-full bg-blue-50 items-center justify-center">
                <Ionicons name="search" size={16} color="#2563EB" />
              </View>
            </Pressable>
            <Pressable 
              onPress={() => {
                toggleFab();
                const selectedDay = usePlannerStore.getState().selectedDay || 1;
                router.push(`/trip/${tripId}/itinerary?day=${selectedDay}` as any);
              }}
              className="bg-white px-4 py-2.5 rounded-full shadow-lg border border-gray-100 flex-row items-center mb-2"
            >
              <Typography variant="bodySemibold" className="text-gray-900 mr-2">Ottimizza con AI</Typography>
              <View className="w-8 h-8 rounded-full bg-green-50 items-center justify-center">
                <Ionicons name="color-wand" size={16} color="#10B981" />
              </View>
            </Pressable>
          </Animated.View>

          <Pressable onPress={toggleFab}>
            <Animated.View style={fabAnimatedStyle} className="w-14 h-14 bg-gray-900 rounded-full shadow-lg items-center justify-center">
              <Ionicons name="add" size={32} color="#FFFFFF" />
            </Animated.View>
          </Pressable>
        </View>
      )}
      
      {/* 3-dots Action Menu Modal */}
      <Modal 
        visible={showMenu} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setShowMenu(false)}
      >
        <Pressable className="flex-1 bg-black/40 justify-end p-5" onPress={() => setShowMenu(false)}>
          <View className="bg-white rounded-3xl p-5 shadow-xl border border-gray-100" onStartShouldSetResponder={() => true}>
            <View className="w-12 h-1 bg-gray-200 rounded-full self-center mb-4" />
            <Typography variant="captionSemibold" className="text-gray-400 uppercase tracking-wider mb-3 px-2">
              Gestisci Viaggio
            </Typography>
            
            <Pressable 
              onPress={() => {
                setShowMenu(false);
                router.push({ pathname: '/trip/create', params: { editTripId: tripId } } as any);
              }}
              className="flex-row items-center p-4 rounded-2xl active:bg-gray-50"
            >
              <Ionicons name="create-outline" size={22} color="#1C1C1E" className="mr-3.5" />
              <Typography variant="bodySemibold" className="text-gray-900 text-base">Modifica viaggio</Typography>
            </Pressable>

            <Pressable 
              onPress={async () => {
                setShowMenu(false);
                await duplicateTrip(tripId);
                router.push('/');
              }}
              className="flex-row items-center p-4 rounded-2xl active:bg-gray-50"
            >
              <Ionicons name="copy-outline" size={22} color="#1C1C1E" className="mr-3.5" />
              <Typography variant="bodySemibold" className="text-gray-900 text-base">Duplica viaggio (date azzerate)</Typography>
            </Pressable>

            <Pressable 
              onPress={async () => {
                setShowMenu(false);
                await archiveTrip(tripId);
                router.push('/');
              }}
              className="flex-row items-center p-4 rounded-2xl active:bg-gray-50"
            >
              <Ionicons name="archive-outline" size={22} color="#1C1C1E" className="mr-3.5" />
              <Typography variant="bodySemibold" className="text-gray-900 text-base">Archivia viaggio</Typography>
            </Pressable>

            <View className="h-px bg-gray-100 my-1" />

            <Pressable 
              onPress={() => {
                setShowMenu(false);
                Alert.alert(
                  'Elimina viaggio',
                  'Sei sicuro di voler eliminare definitivamente questo viaggio e i suoi ricordi?',
                  [
                    { text: 'Annulla', style: 'cancel' },
                    { text: 'Elimina', style: 'destructive', onPress: async () => { await deleteTrip(tripId); router.push('/'); } }
                  ]
                );
              }}
              className="flex-row items-center p-4 rounded-2xl active:bg-red-50"
            >
              <Ionicons name="trash-outline" size={22} color="#EF4444" className="mr-3.5" />
              <Typography variant="bodySemibold" className="text-red-600 text-base">Elimina definitivamente</Typography>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
