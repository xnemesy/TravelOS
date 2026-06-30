import React from 'react';
import { View, ScrollView, SafeAreaView, Pressable, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { FadeIn, SlideInDown, FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { useTripStore } from '../../../src/features/trips/store/trip.store';
import { TripCalculator } from '../../../src/core/travel-engine/trip-calculator';
import { TripEvent } from '../../../src/domain/trip/models/trip.model';

import { Typography } from '../../../src/shared/components/Typography';
import { Card } from '../../../src/shared/components/Card';
import { Button } from '../../../src/shared/components/Button';
import { IconButton } from '../../../src/shared/components/IconButton';
import { radius } from '../../../src/core/theme/radius';

export default function JourneyScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const trip = useTripStore(state => state.getTripById(id as string));
  const events = useTripStore(state => state.getEventsByTripId(id as string));

  if (!trip) return null;

  const now = new Date();
  
  const currentDay = TripCalculator.getCurrentDay(trip, now);
  
  // Per la logica della NOW Card, troviamo l'evento in corso o il prossimo.
  let currentEvent: TripEvent | null = null;
  let nextEvent: TripEvent | null = null;
  
  for (const event of events) {
    if (now >= event.startTime && now <= event.endTime) {
      currentEvent = event;
      break;
    }
    if (now < event.startTime && (!nextEvent || event.startTime < nextEvent.startTime)) {
      nextEvent = event;
    }
  }

  const focusEvent = currentEvent || nextEvent;
  const isOngoing = !!currentEvent;

  // Filtriamo gli eventi di "oggi"
  const todayEvents = events.filter(e => 
    e.startTime.getDate() === now.getDate() && 
    e.startTime.getMonth() === now.getMonth()
  ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'flight': return 'airplane';
      case 'accommodation': return 'bed';
      case 'activity': return 'compass';
      default: return 'calendar';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'flight': return '#007AFF'; // Blue
      case 'accommodation': return '#5856D6'; // Purple
      case 'activity': return '#FF9500'; // Orange
      default: return '#34C759'; // Green
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER MINIMAL (Concept A) */}
      <View className="px-5 py-2 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="flex-row items-center">
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
          <Typography variant="bodySemibold" color="accent" className="ml-1">Viaggi</Typography>
        </Pressable>
        <Typography variant="captionMedium" color="secondary">{currentDay ? `Day ${currentDay}` : 'In arrivo'}</Typography>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        
        {/* TITOLO (Concept A) */}
        <Animated.View entering={FadeIn.duration(400)} className="mb-8 mt-2">
          <Typography variant="overline" color="secondary" className="mb-2">Journey</Typography>
          <Typography variant="h1" className="mb-1">
            {now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
          </Typography>
          <Typography variant="h3" color="secondary">{trip.destination}</Typography>
        </Animated.View>

        {/* NOW CARD (Concept B) */}
        <Animated.View entering={SlideInDown.delay(100).duration(400).springify()}>
          {focusEvent ? (
            <Card 
              padding="none" 
              className="mb-10 overflow-hidden border-0" 
              style={{ backgroundColor: isOngoing ? getEventColor(focusEvent.type) : '#F2F2F7', borderRadius: radius.xxl }}
            >
              <View className="p-6">
                <View className="flex-row justify-between items-center mb-4">
                  <View className={`px-3 py-1 rounded-full ${isOngoing ? 'bg-white/20' : 'bg-gray-200'}`}>
                    <Typography variant="overline" color={isOngoing ? 'inverse' : 'primary'}>
                      {isOngoing ? 'In Corso' : 'Prossimo Evento'}
                    </Typography>
                  </View>
                  <Ionicons name={getEventIcon(focusEvent.type)} size={24} color={isOngoing ? '#FFF' : getEventColor(focusEvent.type)} />
                </View>
                
                <Typography variant="h2" color={isOngoing ? 'inverse' : 'primary'} className="mb-2">
                  {focusEvent.title}
                </Typography>
                
                <Typography variant="bodySemibold" color={isOngoing ? 'inverse' : 'secondary'} style={{ opacity: isOngoing ? 0.8 : 1 }}>
                  {focusEvent.startTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} — {focusEvent.endTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
                </Typography>

                {/* Dettagli contesto finti ma realistici */}
                <View className="mt-4 flex-row items-center">
                  <Ionicons name="location" size={16} color={isOngoing ? '#FFF' : '#8E8E93'} />
                  <Typography variant="captionMedium" color={isOngoing ? 'inverse' : 'secondary'} className="ml-2" style={{ opacity: isOngoing ? 0.8 : 1 }}>
                    {focusEvent.type === 'flight' ? 'Terminal 2, Gate B14' : 'A 12 min a piedi'}
                  </Typography>
                </View>
              </View>

              {/* Contenitore azioni rapide contestuali */}
              <View className={`p-4 flex-row justify-around border-t ${isOngoing ? 'border-white/10 bg-black/10' : 'border-gray-200 bg-white'}`}>
                <Pressable onPress={() => router.push(`/trip/${trip.id}/event/${focusEvent.id}`)} className="items-center">
                  <Ionicons name="map-outline" size={24} color={isOngoing ? '#FFF' : '#007AFF'} />
                  <Typography variant="caption" color={isOngoing ? 'inverse' : 'primary'} className="mt-1">Naviga</Typography>
                </Pressable>
                <Pressable onPress={() => router.push(`/trip/${trip.id}/event/${focusEvent.id}`)} className="items-center">
                  <Ionicons name="receipt-outline" size={24} color={isOngoing ? '#FFF' : '#007AFF'} />
                  <Typography variant="caption" color={isOngoing ? 'inverse' : 'primary'} className="mt-1">Spesa</Typography>
                </Pressable>
                <Pressable onPress={() => router.push(`/trip/${trip.id}/event/${focusEvent.id}`)} className="items-center">
                  <Ionicons name="camera-outline" size={24} color={isOngoing ? '#FFF' : '#007AFF'} />
                  <Typography variant="caption" color={isOngoing ? 'inverse' : 'primary'} className="mt-1">Foto</Typography>
                </Pressable>
              </View>
            </Card>
          ) : (
            <Card className="mb-10 items-center justify-center py-10" variant="flat">
              <Typography variant="bodySemibold" color="secondary">Nessun evento in programma oggi.</Typography>
            </Card>
          )}
        </Animated.View>

        {/* TIMELINE VERTICALE (Concept C) */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)}>
          <Typography variant="h3" className="mb-6 ml-2">La Giornata</Typography>
          
          <View className="pl-4">
            {todayEvents.map((event, index) => {
              const isPast = event.endTime < now;
              const isCurrent = now >= event.startTime && now <= event.endTime;
              const isLast = index === todayEvents.length - 1;
              
              const nodeColor = isPast ? '#C6C6C8' : isCurrent ? getEventColor(event.type) : '#E5E5EA';
              
              return (
                <Pressable 
                  key={event.id}
                  onPress={() => router.push(`/trip/${trip.id}/event/${event.id}`)}
                  className="flex-row mb-6 relative"
                >
                  {/* Linea verticale che connette i nodi */}
                  {!isLast && (
                    <View 
                      className="absolute left-2.5 top-6 bottom-[-24px] w-0.5 bg-gray-200" 
                      style={{ zIndex: -1 }} 
                    />
                  )}
                  
                  {/* Nodo Timeline */}
                  <View className="mr-4 mt-1">
                    <View 
                      className="w-5 h-5 rounded-full items-center justify-center bg-white border-2"
                      style={{ borderColor: nodeColor }}
                    >
                      {isPast && <View className="w-2.5 h-2.5 rounded-full bg-gray-300" />}
                      {isCurrent && <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nodeColor }} />}
                    </View>
                  </View>

                  {/* Contenuto Evento */}
                  <View className={`flex-1 ${isPast ? 'opacity-50' : 'opacity-100'}`}>
                    <Typography variant="bodySemibold" color={isCurrent ? 'primary' : isPast ? 'secondary' : 'primary'}>
                      {event.title}
                    </Typography>
                    <Typography variant="captionMedium" color="secondary" className="mt-0.5">
                      {event.startTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })} 
                      {!isPast && ` — ${event.endTime.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}`}
                    </Typography>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

      </ScrollView>
    </SafeAreaView>
  );
}
