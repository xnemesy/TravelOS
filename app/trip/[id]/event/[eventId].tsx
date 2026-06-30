import React from 'react';
import { View, ScrollView, SafeAreaView, Pressable, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';

import { useTripStore } from '../../../../src/features/trips/store/trip.store';
import { Typography } from '../../../../src/shared/components/Typography';
import { Card } from '../../../../src/shared/components/Card';
import { IconButton } from '../../../../src/shared/components/IconButton';
import { Button } from '../../../../src/shared/components/Button';

export default function EventDetailHubScreen() {
  const { id, eventId } = useLocalSearchParams();
  const router = useRouter();
  
  const events = useTripStore(state => state.getEventsByTripId(id as string));
  const event = events.find(e => e.id === eventId);

  if (!event) {
    return (
      <SafeAreaView className="flex-1 bg-background justify-center items-center">
        <Typography variant="body">Evento non trovato.</Typography>
        <Button label="Torna indietro" onPress={() => router.back()} className="mt-4" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      
      {/* Header Comune */}
      <View className="px-5 py-2 flex-row items-center border-b border-border-light pb-4">
        <Pressable onPress={() => router.back()} className="mr-4 flex-row items-center">
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
          <Typography variant="bodySemibold" color="accent" className="ml-1">Journey</Typography>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* Placeholder Mappa / Cover dell'evento */}
        <Animated.View entering={FadeIn.duration(400)} className="h-48 bg-gray-200 items-center justify-center mb-6">
          <Ionicons name="map" size={40} color="#8E8E93" />
          <Typography variant="captionMedium" color="secondary" className="mt-2">Mappa o Copertina Evento</Typography>
        </Animated.View>

        <View className="px-5">
          {/* Titolo e Dettagli */}
          <Animated.View entering={FadeIn.delay(50).duration(400)} className="mb-8">
            <Typography variant="h1" className="mb-2">{event.title}</Typography>
            <View className="flex-row items-center mb-1">
              <Ionicons name="time-outline" size={18} color="#8E8E93" />
              <Typography variant="body" color="secondary" className="ml-2">
                {event.startTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} — {event.endTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </View>
            <View className="flex-row items-center">
              <Ionicons name="location-outline" size={18} color="#8E8E93" />
              <Typography variant="body" color="secondary" className="ml-2">
                {event.type === 'flight' ? 'Aeroporto Internazionale' : 'Budapest'}
              </Typography>
            </View>
          </Animated.View>

          {/* Quick Actions dell'Evento */}
          <Animated.View entering={SlideInDown.delay(100).duration(400).springify()} className="flex-row justify-between mb-8">
            <View className="items-center w-1/4">
              <IconButton icon="navigate-outline" variant="tonal" color="#007AFF" size={24} className="mb-2" />
              <Typography variant="captionMedium">Indicazioni</Typography>
            </View>
            <View className="items-center w-1/4">
              <IconButton icon="document-text-outline" variant="tonal" color="#5856D6" size={24} className="mb-2" />
              <Typography variant="captionMedium">Biglietto</Typography>
            </View>
            <View className="items-center w-1/4">
              <IconButton icon="receipt-outline" variant="tonal" color="#FF3B30" size={24} className="mb-2" />
              <Typography variant="captionMedium">Spesa</Typography>
            </View>
            <View className="items-center w-1/4">
              <IconButton icon="create-outline" variant="tonal" color="#FFCC00" size={24} className="mb-2" />
              <Typography variant="captionMedium">Nota</Typography>
            </View>
          </Animated.View>

          {/* Ricordi (Foto) */}
          <Animated.View entering={SlideInDown.delay(150).duration(400).springify()} className="mb-6">
            <Typography variant="h3" className="mb-4">Ricordi</Typography>
            <Card variant="outlined" className="items-center justify-center py-8 border-dashed">
              <View className="w-12 h-12 bg-gray-100 rounded-full items-center justify-center mb-3">
                <Ionicons name="camera-outline" size={24} color="#8E8E93" />
              </View>
              <Typography variant="bodySemibold" className="mb-1">Aggiungi foto</Typography>
              <Typography variant="caption" color="secondary">Crea un diario visivo di questo momento</Typography>
            </Card>
          </Animated.View>

          {/* Spese collegate */}
          <Animated.View entering={SlideInDown.delay(200).duration(400).springify()} className="mb-6">
            <Typography variant="h3" className="mb-4">Costi</Typography>
            <Card padding="sm" className="flex-row items-center justify-between">
              <View className="flex-row items-center">
                <View className="bg-red-50 p-2 rounded-lg mr-3">
                  <Ionicons name="receipt" size={20} color="#FF3B30" />
                </View>
                <View>
                  <Typography variant="bodySemibold">Costo Stimato</Typography>
                  <Typography variant="caption" color="secondary">{event.type === 'flight' ? 'Volo' : 'Attività'}</Typography>
                </View>
              </View>
              <Typography variant="bodySemibold">€{event.cost || '0,00'}</Typography>
            </Card>
          </Animated.View>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
