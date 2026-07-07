import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ItineraryDaySummary } from '../../../domain/trip/models/trip.model';
import { Typography } from '../../../shared/components/Typography';

interface ItinerarySummaryProps {
  days: ItineraryDaySummary[];
  onDayPress: (dayNumber: number) => void;
}

export const ItinerarySummary: React.FC<ItinerarySummaryProps> = ({ days, onDayPress }) => {
  if (days.length === 0) return null;

  return (
    <View className="px-6 py-4">
      <View className="mb-6 flex-row justify-between items-center">
        <Typography variant="h3">Il Tuo Itinerario</Typography>
        <Pressable>
          <Typography variant="bodySemibold" className="text-blue-600 text-sm">
            Gestisci
          </Typography>
        </Pressable>
      </View>
      
      <View className="pl-2">
        {days.map((day, index) => {
          const isLast = index === days.length - 1;
          const formattedDate = day.date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'short' });
          const capitalizedDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);
          
          let summaryParts = [];
          if (day.placesCount > 0) summaryParts.push(`${day.placesCount} luoghi`);
          if (day.restaurantsCount > 0) summaryParts.push(`${day.restaurantsCount} ristoranti`);
          if (day.museumsCount && day.museumsCount > 0) summaryParts.push(`${day.museumsCount} musei`);
          
          const summaryText = summaryParts.length > 0 ? summaryParts.join(', ') : 'Nessuna attività pianificata';

          return (
            <Pressable 
              key={day.dayNumber}
              onPress={() => onDayPress(day.dayNumber)}
              className="flex-row relative"
            >
              {/* Timeline Line */}
              {!isLast && (
                <View className="absolute left-[5px] top-[24px] bottom-[-16px] w-[2px] bg-gray-100" />
              )}
              
              {/* Timeline Node */}
              <View className="w-3 h-3 rounded-full bg-gray-300 mt-[6px] mr-4 border-2 border-white" />
              
              {/* Content */}
              <View className="flex-1 pb-6">
                <View className="flex-row justify-between items-baseline mb-1">
                  <Typography variant="bodySemibold" className="text-gray-900">
                    Giorno {day.dayNumber}
                  </Typography>
                  <Typography variant="caption" className="text-gray-400 capitalize">
                    {capitalizedDate}
                  </Typography>
                </View>
                
                <Typography variant="captionMedium" className="text-gray-500">
                  {summaryText}
                </Typography>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
