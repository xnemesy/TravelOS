import React from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Trip } from '../../../domain/trip/models/trip.model';
import { TripCalculator } from '../../../core/travel-engine/trip-calculator';
import { Typography } from '../../../shared/components/Typography';
import { Card } from '../../../shared/components/Card';

interface TripCardProps {
  trip: Trip;
  onPress: () => void;
  index: number;
}

export const TripCard: React.FC<TripCardProps> = ({ trip, onPress, index }) => {
  const now = new Date();
  const status = TripCalculator.getTripStatus(trip, now);
  const countdown = TripCalculator.getCountdown(trip, now);
  
  const getStatusBadge = () => {
    if (status === 'ongoing') {
      return (
        <View className="bg-green-100 px-2 py-1 rounded-full">
          <Typography variant="captionMedium" className="text-green-800">In corso</Typography>
        </View>
      );
    }
    if (status === 'completed') {
      return (
        <View className="bg-gray-100 px-2 py-1 rounded-full">
          <Typography variant="captionMedium" className="text-gray-600">Completato</Typography>
        </View>
      );
    }
    
    // Status 'planned'
    let text = '';
    if (countdown.days > 0) text = `Tra ${countdown.days} giorni`;
    else if (countdown.hours > 0) text = `Oggi, tra ${countdown.hours} ore`;
    else text = `Tra pochi minuti`;

    return (
      <View className="bg-blue-100 px-2 py-1 rounded-full">
        <Typography variant="captionMedium" className="text-blue-800">{text}</Typography>
      </View>
    );
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 100).duration(400)} className="mb-4">
      <Card onPress={onPress}>
        <View className="flex-row justify-between items-start mb-2">
          <View className="flex-1 pr-4">
            <Typography variant="h3" className="mb-1">{trip.title}</Typography>
            <Typography variant="body" color="secondary">{trip.destination}</Typography>
          </View>
          {getStatusBadge()}
        </View>
        
        <View className="mt-4 pt-4 border-t border-border-light">
          <Typography variant="overline" color="secondary">
            {trip.startDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - {trip.endDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Typography>
        </View>
      </Card>
    </Animated.View>
  );
};
