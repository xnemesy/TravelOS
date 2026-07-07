import React from 'react';
import { View, ScrollView, ImageBackground, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TravelPlace } from '../../../domain/trip/models/place.model';
import { Typography } from '../../../shared/components/Typography';
import { radius } from '../../../core/theme/radius';

import { useRouter } from 'expo-router';

interface PlacesCarouselProps {
  tripId: string;
  places: TravelPlace[];
  onAddPress: () => void;
}

export const PlacesCarousel: React.FC<PlacesCarouselProps> = ({ tripId, places, onAddPress }) => {
  const router = useRouter();

  if (places.length === 0) {
    return (
      <View className="px-6 py-4">
        <Typography variant="h3" className="mb-4">I Tuoi Luoghi da Scoprire</Typography>
        <Pressable 
          onPress={onAddPress}
          className="w-full py-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center border-dashed"
        >
          <Ionicons name="map-outline" size={32} color="#9CA3AF" className="mb-2" />
          <Typography variant="bodySemibold" className="text-gray-500">
            Inizia a sognare. Aggiungi il primo luogo.
          </Typography>
        </Pressable>
      </View>
    );
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case 'restaurant': return 'restaurant-outline';
      case 'hotel': return 'bed-outline';
      case 'museum': return 'color-palette-outline';
      default: return 'business-outline';
    }
  };

  return (
    <View className="py-6">
      <View className="px-6 mb-4 flex-row justify-between items-center">
        <Typography variant="h3">I Tuoi Luoghi da Scoprire ({places.length})</Typography>
        <Pressable onPress={() => router.push(`/trip/${tripId}/places` as any)}>
          <Typography variant="bodySemibold" className="text-blue-600 text-sm">
            Vedi tutti
          </Typography>
        </Pressable>
      </View>
      
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
      >
        {places.map((place) => (
          <Pressable 
            key={place.id}
            onPress={() => router.push(`/trip/${tripId}/places/${place.id}` as any)}
            className="w-40 h-56 bg-gray-100 overflow-hidden shadow-sm active:opacity-80"
            style={{ borderRadius: radius.xl }}
          >
            <ImageBackground
              source={{ uri: place.baseData?.coverImageUrl || 'https://via.placeholder.com/300' }}
              className="w-full h-full justify-end"
              resizeMode="cover"
            >
              <View className="absolute inset-0 bg-black/30" />
              <View className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              
              <View className="p-3">
                <View className="flex-row items-center justify-between mb-1">
                  <Typography variant="caption" className="text-white/90 uppercase tracking-wider font-medium text-[10px]">
                    {place.baseData?.category}
                  </Typography>
                  {place.baseData?.rating && (
                    <View className="flex-row items-center bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
                      <Ionicons name="star" size={10} color="#FBBF24" />
                      <Typography variant="captionMedium" className="text-white ml-1 text-[10px]">
                        {place.baseData.rating}
                      </Typography>
                    </View>
                  )}
                </View>
                <Typography variant="bodySemibold" className="text-white leading-tight" numberOfLines={2}>
                  {place.baseData?.name}
                </Typography>
              </View>
            </ImageBackground>
          </Pressable>
        ))}
        
        {/* Add more card */}
        <Pressable 
          onPress={onAddPress}
          className="w-20 h-56 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center active:bg-gray-100"
        >
          <Ionicons name="add" size={24} color="#6B7280" />
        </Pressable>
      </ScrollView>
    </View>
  );
};
