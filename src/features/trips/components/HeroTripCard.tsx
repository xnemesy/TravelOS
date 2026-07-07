import React from 'react';
import { View, ImageBackground, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Trip } from '../../../domain/trip/models/trip.model';
import { TripCalculator } from '../../../core/travel-engine/trip-calculator';
import { Typography } from '../../../shared/components/Typography';
import { radius } from '../../../core/theme/radius';

interface HeroTripCardProps {
  trip: Trip;
  onPress: () => void;
  onContinuePress?: () => void;
  onMenuPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const HeroTripCard: React.FC<HeroTripCardProps> = ({ trip, onPress, onContinuePress, onMenuPress }) => {
  const scale = useSharedValue(1);
  const now = new Date();
  const status = TripCalculator.getTripStatus(trip, now);
  const countdown = TripCalculator.getCountdown(trip, now);
  const progress = TripCalculator.getProgress(trip, now);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.97, { stiffness: 400, damping: 25 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 25 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getCountdownLabel = () => {
    if (status === 'ongoing') return 'In corso';
    if (status === 'completed') return 'Completato';
    if (countdown.days > 0) return `Tra ${countdown.days} giorni`;
    if (countdown.hours > 0) return `Tra ${countdown.hours} ore`;
    return 'Partenza imminente';
  };

  const renderContextualInfo = () => {
    switch (status) {
      case 'planned': {
        const savedCount = trip.stats?.savedPlaces || 0;
        const resCount = trip.stats?.reservations || 0;
        const organizedDays = trip.stats?.organizedDays || 0;
        const totalDays = TripCalculator.getDuration(trip) + 1;
        const totalItems = savedCount + resCount;
        const planProgress = trip.progress !== undefined ? trip.progress : (totalItems > 0 ? Math.min(5 + totalItems * 5, 100) : 0);
        
        let label = 'Ancora da pianificare';
        if (organizedDays > 0) {
          if (organizedDays === totalDays) {
            label = `Itinerario completo • ${savedCount} ${savedCount === 1 ? 'luogo salvato' : 'luoghi salvati'}`;
          } else {
            label = `${organizedDays} di ${totalDays} giornate pianificate • ${savedCount} ${savedCount === 1 ? 'luogo' : 'luoghi'}`;
          }
        } else if (savedCount > 0) {
          label = `${savedCount} ${savedCount === 1 ? 'luogo salvato' : 'luoghi salvati'} • Da pianificare`;
        }

        return (
          <View className="w-full">
            <Typography variant="captionMedium" className="text-white/90 mb-1.5 font-medium">
              {label}
            </Typography>
            <View className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <View className="h-full bg-green-400 rounded-full" style={{ width: `${planProgress}%` }} />
            </View>
          </View>
        );
      }
      case 'ready':
        return (
          <View className="w-full">
            <Typography variant="captionMedium" className="text-white/90 mb-1.5 font-medium">
              Tutto pronto • 100% pianificato
            </Typography>
            <View className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
              <View className="h-full bg-green-400 rounded-full" style={{ width: '100%' }} />
            </View>
          </View>
        );
      case 'ongoing':
        const currentDay = TripCalculator.getCurrentDay(trip, now) || 1;
        const totalDays = TripCalculator.getDuration(trip) + 1;
        return (
          <View>
            <Typography variant="captionMedium" className="text-white/90">
              Giorno {currentDay} di {totalDays}
            </Typography>
            {trip.weather && (
              <Typography variant="caption" className="text-white/80 mt-0.5">
                {trip.weather.temp}° • {trip.weather.condition}
              </Typography>
            )}
          </View>
        );
      case 'completed':
        return (
          <Typography variant="captionMedium" className="text-white/90">
            {trip.stats?.totalPhotos || 0} foto salvate • {trip.stats?.distanceTraveled || 0} km percorsi
          </Typography>
        );
      default:
        return null;
    }
  };

  const getStatusBadgeProps = () => {
    switch (status) {
      case 'ready':
        return { bg: 'bg-[#E6F4EA]', textCol: '#137333', label: 'Pronto' };
      case 'ongoing':
        return { bg: 'bg-[#FEF7E0]', textCol: '#B06000', label: 'In viaggio' };
      case 'completed':
        return { bg: 'bg-[#F1F3F4]', textCol: '#5F6368', label: 'Completato' };
      default:
        return { bg: 'bg-[#EBF5FF]', textCol: '#1E40AF', label: 'In preparazione' };
    }
  };

  const badge = getStatusBadgeProps();

  const getHeroContext = () => {
    const organizedDays = trip.stats?.organizedDays || 0;
    const totalDays = TripCalculator.getDuration(trip) + 1;

    switch (status) {
      case 'planned': {
        let dynamicLabel = 'Pianificazione';
        if (countdown.days <= 3 && countdown.days > 0) {
          dynamicLabel = 'Viaggio imminente';
        } else if (organizedDays === totalDays && organizedDays > 0) {
          dynamicLabel = 'Pronto per partire';
        } else if (organizedDays > 0) {
          dynamicLabel = 'Itinerario in costruzione';
        }
        return {
          label: dynamicLabel,
          image: trip.coverImageUrl || 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?q=80&w=1200&auto=format&fit=crop'
        };
      }
      case 'ready': return {
        label: countdown.days <= 3 ? 'Viaggio imminente' : 'Pronto per partire',
        image: trip.coverImageUrl || 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=1200&auto=format&fit=crop'
      };
      case 'ongoing': {
        const hour = now.getHours();
        const timeGreeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';
        return {
          label: `${timeGreeting} da ${trip.destination}`,
          image: trip.coverImageUrl || 'https://images.unsplash.com/photo-1506929562872-bb421503ef21?q=80&w=1200&auto=format&fit=crop'
        };
      }
      case 'completed': return {
        label: 'I tuoi ricordi',
        image: trip.coverImageUrl || 'https://images.unsplash.com/photo-1500835556837-99ac94a94552?q=80&w=1200&auto=format&fit=crop'
      };
      default: return {
        label: 'Prossimo viaggio',
        image: trip.coverImageUrl || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200&auto=format&fit=crop'
      };
    }
  };

  const heroContext = getHeroContext();

  const formattedDates = `${trip.startDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })} - ${trip.endDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}`;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, { borderRadius: radius.xl }]}
      className="w-full h-80 overflow-hidden shadow-md bg-gray-900 mb-8"
    >
      <ImageBackground
        source={{ uri: heroContext.image }}
        className="w-full h-full justify-between"
        resizeMode="cover"
      >
        {/* Dark overlay for contrast */}
        <View className="absolute inset-0 bg-black/45 justify-between p-6">
          {/* Top Row: Category + Countdown + Menu */}
          <View className="flex-row justify-between items-center">
            <View className="flex-row items-center">
              {trip.emoji ? <Typography variant="h3" className="mr-2">{trip.emoji}</Typography> : null}
              <Typography variant="overline" className="text-white/80 tracking-widest">
                {heroContext.label}
              </Typography>
            </View>
            <View className="flex-row items-center gap-2">
              {status !== 'ongoing' && status !== 'completed' && (
                <View className="bg-white/95 px-3 py-1 rounded-full shadow-sm">
                  <Typography variant="captionMedium" className="text-gray-900">
                    {getCountdownLabel()}
                  </Typography>
                </View>
              )}
              {onMenuPress && (
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    Haptics.selectionAsync();
                    onMenuPress();
                  }}
                  className="w-8 h-8 rounded-full bg-black/40 items-center justify-center active:bg-black/60"
                >
                  <Typography variant="bodySemibold" color="inverse" className="text-white">•••</Typography>
                </Pressable>
              )}
            </View>
          </View>

          {/* Middle Row: Title, Destination & Dates */}
          <View className="my-auto py-2">
            <Typography variant="h1" className="text-white text-3xl font-bold tracking-tight mb-1">
              {trip.title}
            </Typography>
            <Typography variant="body" className="text-white/90 font-medium">
              📍 {trip.destination} • {formattedDates}
            </Typography>
          </View>

          {/* Bottom Row: Contextual Info & Continue Button */}
          <View className="flex-row justify-between items-end">
            <View className="flex-1 pr-4">
              <View className="flex-row items-center space-x-2 mb-1.5">
                <View className={`${badge.bg} px-2.5 py-0.5 rounded-full mr-2`}>
                  <Typography variant="captionMedium" style={{ color: badge.textCol, fontSize: 11 }}>
                    {badge.label}
                  </Typography>
                </View>
              </View>
              {renderContextualInfo()}
            </View>

            {/* Continua Button - Ridotto e alleggerito */}
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.selectionAsync();
                if (onContinuePress) onContinuePress();
                else onPress();
              }}
              className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-full border border-white/30 active:bg-white/30"
            >
              <Typography variant="captionMedium" className="text-white">
                Continua
              </Typography>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </AnimatedPressable>
  );
};
