import React from 'react';
import { View, ImageBackground, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Trip } from '../../../domain/trip/models/trip.model';
import { TripCalculator } from '../../../core/travel-engine/trip-calculator';
import { Typography } from '../../../shared/components/Typography';

interface TripHeroHeaderProps {
  trip: Trip;
}

export const TripHeroHeader: React.FC<TripHeroHeaderProps> = ({ trip }) => {
  const router = useRouter();
  const now = new Date();
  const countdown = TripCalculator.getCountdown(trip, now);
  const status = TripCalculator.getTripStatus(trip, now);

  const formattedDates = `${trip.startDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${trip.endDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;

  const getCountdownLabel = () => {
    if (status === 'ongoing') return 'In corso';
    if (status === 'completed') return 'Completato';
    if (countdown.days > 0) return `Tra ${countdown.days} giorni`;
    if (countdown.hours > 0) return `Tra ${countdown.hours} ore`;
    return 'Partenza imminente';
  };

  return (
    <View className="w-full h-80 bg-gray-900 relative">
      <ImageBackground
        source={{ uri: trip.coverImageUrl }}
        className="w-full h-full"
        resizeMode="cover"
      >
        {/* Gradient Overlay for bottom text readability */}
        <View className="absolute inset-0 bg-black/30" />
        <View className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />
        
        {/* Header Actions */}
        <View className="absolute top-14 left-0 right-0 px-4 flex-row justify-between items-center">
          <Pressable 
            onPress={() => router.back()}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20"
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Pressable className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
            <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Content */}
        <View className="absolute bottom-6 left-6 right-6">
          <Typography variant="h1" className="text-white text-4xl font-bold tracking-tight mb-1">
            {trip.destination.split(',')[0]}
          </Typography>
          <View className="flex-row items-center justify-between mb-3">
            <Typography variant="bodySemibold" className="text-white/90">
              {formattedDates}
            </Typography>
          </View>
          
          {/* Live Stats */}
          <View className="flex-row items-center space-x-3">
            <Typography variant="captionMedium" className="text-white/90">
              {getCountdownLabel()}
            </Typography>
            <Typography variant="captionMedium" className="text-white/50">•</Typography>
            <Typography variant="captionMedium" className="text-white/90">
              {trip.stats?.savedPlaces || 0} Luoghi
            </Typography>
            {trip.stats?.reservations ? (
              <>
                <Typography variant="captionMedium" className="text-white/50">•</Typography>
                <Typography variant="captionMedium" className="text-white/90">
                  {trip.stats.reservations} Prenotazioni
                </Typography>
              </>
            ) : null}
          </View>
        </View>
      </ImageBackground>
    </View>
  );
};
