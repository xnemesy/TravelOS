import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../shared/components/Typography';

import { useRouter } from 'expo-router';

interface TripInfoListProps {
  tripId: string;
}

export const TripInfoList: React.FC<TripInfoListProps> = ({ tripId }) => {
  const router = useRouter();
  
  const sections = [
    { id: 'hotel', title: 'Hotel', icon: 'bed-outline', value: '1 prenotazione', route: `/trip/${tripId}/itinerary?filter=accommodation` },
    { id: 'documents', title: 'Documenti', icon: 'document-text-outline', value: '3 documenti', route: `/trip/${tripId}/documents` },
    { id: 'budget', title: 'Budget', icon: 'wallet-outline', value: '€370 spesi', route: `/trip/${tripId}/budget` },
    { id: 'transport', title: 'Trasporti', icon: 'bus-outline', value: '1 spostamento', route: `/trip/${tripId}/itinerary?filter=transport` },
  ];

  return (
    <View className="px-6 py-6 mt-4">
      <Typography variant="h3" className="mb-4">Informazioni Chiave</Typography>
      
      <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
        {sections.map((section, index) => {
          const isLast = index === sections.length - 1;
          
          return (
            <Pressable 
              key={section.id}
              onPress={() => router.push(section.route as any)}
              className={`flex-row items-center justify-between p-4 bg-white active:bg-gray-50 ${!isLast ? 'border-b border-gray-100' : ''}`}
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center mr-3">
                  <Ionicons name={section.icon as any} size={16} color="#4B5563" />
                </View>
                <Typography variant="bodySemibold" className="text-gray-900">
                  {section.title}
                </Typography>
              </View>
              
              <View className="flex-row items-center space-x-2">
                <Typography variant="captionMedium" className="text-gray-500">
                  {section.value}
                </Typography>
                <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};
