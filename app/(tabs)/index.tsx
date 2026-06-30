import React, { useEffect } from 'react';
import { View, ScrollView, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { useTripStore } from '../../src/features/trips/store/trip.store';
import { TripCard } from '../../src/features/trips/components/TripCard';
import { Typography } from '../../src/shared/components/Typography';

export default function TripsListScreen() {
  const router = useRouter();
  const { trips, loadTrips, setActiveTrip } = useTripStore();

  useEffect(() => {
    loadTrips();
  }, []);

  const handleTripPress = (id: string) => {
    setActiveTrip(id);
    router.push(`/trip/${id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 100 }}
      >
        <Typography variant="h1" className="mb-6">I tuoi viaggi</Typography>
        
        {trips.length === 0 ? (
          <View className="items-center justify-center py-20">
            <Typography variant="body" color="secondary">Nessun viaggio in programma.</Typography>
          </View>
        ) : (
          trips.map((trip, index) => (
            <TripCard 
              key={trip.id} 
              trip={trip} 
              index={index} 
              onPress={() => handleTripPress(trip.id)} 
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
