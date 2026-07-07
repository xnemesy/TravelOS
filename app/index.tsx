import React, { useState } from 'react';
import { View, ScrollView, StatusBar, Modal, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '../src/features/trips/store/trip.store';
import { HeroTripCard } from '../src/features/trips/components/HeroTripCard';
import { CompactTripRow } from '../src/features/trips/components/CompactTripRow';
import { Typography } from '../src/shared/components/Typography';
import { IconButton } from '../src/shared/components/IconButton';
import { Button } from '../src/shared/components/Button';
import { TripCalculator } from '../src/core/travel-engine/trip-calculator';

export default function TripsListScreen() {
  const router = useRouter();
  const { trips, loadTrips, setActiveTrip, duplicateTrip, archiveTrip, deleteTrip } = useTripStore();
  const [menuTripId, setMenuTripId] = useState<string | null>(null);

  useFocusEffect(
    React.useCallback(() => {
      loadTrips();
    }, [])
  );

  const handleTripPress = (id: string) => {
    setActiveTrip(id);
    router.push(`/trip/${id}`);
  };

  // Solo viaggi attivi in Home (gli archiviati sono nel Profilo)
  const activeTrips = trips.filter(t => t.status !== 'archived');
  const now = new Date();
  const sortedTrips = [...activeTrips].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  
  const heroTrip = 
    sortedTrips.find(t => TripCalculator.getTripStatus(t, now) === 'ongoing') ||
    sortedTrips.find(t => TripCalculator.getTripStatus(t, now) === 'ready') ||
    sortedTrips.find(t => TripCalculator.getTripStatus(t, now) === 'planned') ||
    sortedTrips[0];

  const otherTrips = activeTrips.filter(t => t.id !== heroTrip?.id);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Elegante & Respiro Tipografico */}
        <View className="flex-row justify-between items-start mb-8 pt-2">
          <View className="flex-1 pr-4">
            <Typography variant="h1" className="text-4xl font-bold tracking-tight text-text-primary mb-1.5">
              I tuoi viaggi
            </Typography>
            <Typography variant="body" color="secondary" className="text-base leading-relaxed">
              Continua ad organizzare la tua prossima avventura.
            </Typography>
          </View>
          
          <View className="flex-row items-center space-x-3">
            <View className="mr-2">
              <IconButton 
                icon="person-outline" 
                variant="tonal" 
                size={20} 
                onPress={() => router.push('/profile' as any)} 
              />
            </View>
            <IconButton 
              icon="add" 
              variant="solid" 
              color="#1C1C1E"
              size={20} 
              onPress={() => router.push('/trip/create' as any)} 
            />
          </View>
        </View>
        
        {/* Sezione Viaggi o Stato Vuoto */}
        {activeTrips.length === 0 ? (
          <View className="items-center justify-center py-20 px-6 bg-card rounded-3xl border border-border-light shadow-sm my-4">
            <View className="w-16 h-16 rounded-full bg-green-50 items-center justify-center mb-4">
              <Ionicons name="compass-outline" size={32} color="#10B981" />
            </View>
            <Typography variant="h2" className="text-gray-900 text-center mb-2">
              Il tuo prossimo viaggio inizia qui
            </Typography>
            <Typography variant="body" color="secondary" align="center" className="mb-8 max-w-xs leading-relaxed">
              Crea il tuo primo itinerario per esplorare il mondo con la semplicità di Travel OS.
            </Typography>
            <Button
              label="Crea il primo viaggio"
              onPress={() => router.push('/trip/create' as any)}
              variant="solid"
              size="md"
              icon="add"
            />
          </View>
        ) : (
          <>
            {/* Sezione Prossimo Viaggio (Hero Card) */}
            {heroTrip && (
              <HeroTripCard
                trip={heroTrip}
                onPress={() => handleTripPress(heroTrip.id)}
                onContinuePress={() => handleTripPress(heroTrip.id)}
                onMenuPress={() => setMenuTripId(heroTrip.id)}
              />
            )}

            {/* Sezione Altri Viaggi (Lista Editoriale) */}
            {otherTrips.length > 0 && (
              <View className="mt-4">
                <Typography variant="h3" className="text-xl font-semibold tracking-tight text-text-primary mb-4">
                  Altri viaggi
                </Typography>
                <View className="bg-card rounded-3xl p-5 shadow-sm border border-border-light">
                  {otherTrips.map((trip, index) => (
                    <CompactTripRow
                      key={trip.id}
                      trip={trip}
                      onPress={() => handleTripPress(trip.id)}
                      isLast={index === otherTrips.length - 1}
                      onMenuPress={() => setMenuTripId(trip.id)}
                    />
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* 3-dots Action Menu Modal */}
      <Modal 
        visible={Boolean(menuTripId)} 
        transparent 
        animationType="fade" 
        onRequestClose={() => setMenuTripId(null)}
      >
        <Pressable className="flex-1 bg-black/40 justify-end p-5" onPress={() => setMenuTripId(null)}>
          <View className="bg-white rounded-3xl p-5 shadow-xl border border-gray-100" onStartShouldSetResponder={() => true}>
            <View className="w-12 h-1 bg-gray-200 rounded-full self-center mb-4" />
            <Typography variant="captionSemibold" className="text-gray-400 uppercase tracking-wider mb-3 px-2">
              Gestisci Viaggio
            </Typography>
            
            <Pressable 
              onPress={() => {
                const id = menuTripId;
                setMenuTripId(null);
                router.push({ pathname: '/trip/create', params: { editTripId: id } } as any);
              }}
              className="flex-row items-center p-4 rounded-2xl active:bg-gray-50"
            >
              <Ionicons name="create-outline" size={22} color="#1C1C1E" className="mr-3.5" />
              <Typography variant="bodySemibold" className="text-gray-900 text-base">Modifica viaggio</Typography>
            </Pressable>

            <Pressable 
              onPress={async () => {
                const id = menuTripId;
                setMenuTripId(null);
                if (id) await duplicateTrip(id);
              }}
              className="flex-row items-center p-4 rounded-2xl active:bg-gray-50"
            >
              <Ionicons name="copy-outline" size={22} color="#1C1C1E" className="mr-3.5" />
              <Typography variant="bodySemibold" className="text-gray-900 text-base">Duplica viaggio (date azzerate)</Typography>
            </Pressable>

            <Pressable 
              onPress={async () => {
                const id = menuTripId;
                setMenuTripId(null);
                if (id) await archiveTrip(id);
              }}
              className="flex-row items-center p-4 rounded-2xl active:bg-gray-50"
            >
              <Ionicons name="archive-outline" size={22} color="#1C1C1E" className="mr-3.5" />
              <Typography variant="bodySemibold" className="text-gray-900 text-base">Archivia viaggio</Typography>
            </Pressable>

            <View className="h-px bg-gray-100 my-1" />

            <Pressable 
              onPress={() => {
                const id = menuTripId;
                setMenuTripId(null);
                Alert.alert(
                  'Elimina viaggio',
                  'Sei sicuro di voler eliminare definitivamente questo viaggio e i suoi ricordi?',
                  [
                    { text: 'Annulla', style: 'cancel' },
                    { text: 'Elimina', style: 'destructive', onPress: async () => { if (id) await deleteTrip(id); } }
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
