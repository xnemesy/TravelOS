import React, { useState } from 'react';
import { View, ScrollView, StatusBar, Pressable, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTripStore } from '../src/features/trips/store/trip.store';
import { CompactTripRow } from '../src/features/trips/components/CompactTripRow';
import { Typography } from '../src/shared/components/Typography';

export default function ArchivedTripsScreen() {
  const router = useRouter();
  const { trips, updateTrip, deleteTrip, setActiveTrip } = useTripStore();
  const [menuTripId, setMenuTripId] = useState<string | null>(null);

  const archivedTrips = trips.filter(t => t.status === 'archived');

  const handleTripPress = (id: string) => {
    setActiveTrip(id);
    router.push(`/trip/${id}`);
  };

  const handleRestore = async (id: string) => {
    await updateTrip(id, { status: 'planned' });
    setMenuTripId(null);
  };

  const handleDelete = (id: string) => {
    setMenuTripId(null);
    Alert.alert(
      'Elimina definitivamente',
      'Sei sicuro di voler cancellare questo viaggio archiviato e tutti i suoi ricordi?',
      [
        { text: 'Annulla', style: 'cancel' },
        { text: 'Elimina', style: 'destructive', onPress: async () => { await deleteTrip(id); } }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="flex-row items-center -ml-2 p-2">
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
          <Typography variant="bodySemibold" className="text-gray-900 ml-1">Profilo</Typography>
        </Pressable>
        <Typography variant="h3" className="text-gray-900">Viaggi Archiviati</Typography>
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        {archivedTrips.length === 0 ? (
          <View className="items-center justify-center py-20 px-6 bg-card rounded-3xl border border-border-light shadow-sm my-6">
            <View className="w-16 h-16 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Ionicons name="archive-outline" size={32} color="#6B7280" />
            </View>
            <Typography variant="h2" className="text-gray-900 text-center mb-2">
              Nessun viaggio archiviato
            </Typography>
            <Typography variant="body" color="secondary" align="center" className="max-w-xs leading-relaxed">
              I viaggi che decidi di archiviare dalla schermata Home verranno custoditi qui al sicuro.
            </Typography>
          </View>
        ) : (
          <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 mb-12">
            {archivedTrips.map((trip, index) => (
              <CompactTripRow
                key={trip.id}
                trip={trip}
                onPress={() => handleTripPress(trip.id)}
                isLast={index === archivedTrips.length - 1}
                onMenuPress={() => setMenuTripId(trip.id)}
              />
            ))}
          </View>
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
              Viaggio Archiviato
            </Typography>
            
            <Pressable 
              onPress={() => {
                if (menuTripId) handleRestore(menuTripId);
              }}
              className="flex-row items-center p-4 rounded-2xl active:bg-gray-50"
            >
              <Ionicons name="refresh-outline" size={22} color="#10B981" className="mr-3.5" />
              <Typography variant="bodySemibold" className="text-green-700 text-base">Ripristina in Home</Typography>
            </Pressable>

            <View className="h-px bg-gray-100 my-1" />

            <Pressable 
              onPress={() => {
                if (menuTripId) handleDelete(menuTripId);
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
