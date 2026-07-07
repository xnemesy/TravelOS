import React from 'react';
import { View, Pressable } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Trip } from '../../../domain/trip/models/trip.model';
import { TripCalculator } from '../../../core/travel-engine/trip-calculator';
import { Typography } from '../../../shared/components/Typography';

interface CompactTripRowProps {
  trip: Trip;
  onPress: () => void;
  isLast?: boolean;
  onMenuPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const CompactTripRow: React.FC<CompactTripRowProps> = ({ trip, onPress, isLast = false, onMenuPress }) => {
  const scale = useSharedValue(1);
  const now = new Date();
  const status = TripCalculator.getTripStatus(trip, now);
  const progress = TripCalculator.getProgress(trip, now);

  const handlePressIn = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.98, { stiffness: 400, damping: 25 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { stiffness: 400, damping: 25 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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
  const formattedDates = `${trip.startDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })} - ${trip.endDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
      className={`py-4 ${!isLast ? 'border-b border-border-light/60' : ''}`}
    >
      <View className="flex-row justify-between items-center">
        {/* Left Column: Destination & Period */}
        <View className="flex-1 pr-4 flex-row items-center">
          {trip.emoji ? (
            <View className="w-11 h-11 rounded-2xl bg-gray-100 items-center justify-center mr-3">
              <Typography variant="h3" className="text-xl">{trip.emoji}</Typography>
            </View>
          ) : null}
          <View className="flex-1">
            <Typography variant="bodySemibold" className="text-lg text-text-primary mb-0.5">
              {trip.title}
            </Typography>
            <Typography variant="caption" color="secondary">
              📍 {trip.destination} • {formattedDates}
            </Typography>
          </View>
        </View>

        {/* Right Column: Status Badge & Mini Progress & Menu */}
        <View className="flex-row items-center gap-2">
          <View className="items-end">
            <View className={`${badge.bg} px-3 py-1 rounded-full mb-1.5`}>
              <Typography variant="captionMedium" style={{ color: badge.textCol }}>
                {badge.label}
              </Typography>
            </View>
            {status !== 'completed' && (
              <View className="flex-row items-center">
                <View className="w-12 bg-gray-200 h-1 rounded-full overflow-hidden mr-1.5">
                  <View className="bg-gray-600 h-full rounded-full" style={{ width: `${progress}%` }} />
                </View>
                <Typography variant="overline" color="secondary" className="text-[10px]">
                  {progress}%
                </Typography>
              </View>
            )}
          </View>
          {onMenuPress && (
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                Haptics.selectionAsync();
                onMenuPress();
              }}
              className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200 ml-1"
            >
              <Typography variant="bodySemibold" className="text-gray-600">•••</Typography>
            </Pressable>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
};
