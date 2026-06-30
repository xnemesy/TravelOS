import React from 'react';
import { Pressable, PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

export type IconButtonVariant = 'solid' | 'tonal' | 'ghost';

interface IconButtonProps extends PressableProps {
  icon: keyof typeof Ionicons.glyphMap;
  variant?: IconButtonVariant;
  color?: string; // Colore base per icona e sfondi derivati
  size?: number; // Size dell'icona
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const IconButton: React.FC<IconButtonProps> = ({ 
  icon, 
  variant = 'tonal', 
  color = '#007AFF', // Brand default
  size = 24,
  className,
  onPressIn,
  onPressOut,
  ...props 
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = (e: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSpring(0.9, { stiffness: 400, damping: 20 });
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, { stiffness: 400, damping: 20 });
    if (onPressOut) onPressOut(e);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Convert hex color to slightly transparent for tonal backgrounds
  // E.g. #007AFF -> rgba(0, 122, 255, 0.1)
  // This is a naive conversion, usually we'd use a theme helper, but for now we'll just use Tailwind classes for common colors
  
  let containerClasses = 'rounded-full items-center justify-center';
  let iconColor = color;
  let bgStyle = {};

  switch (variant) {
    case 'solid':
      bgStyle = { backgroundColor: color };
      iconColor = '#FFFFFF';
      break;
    case 'tonal':
      // Usiamo un grigio neutro tenue se non vogliamo gestire rgb() dinamico, o bg-gray-100
      containerClasses += ' bg-gray-100';
      break;
    case 'ghost':
      containerClasses += ' bg-transparent';
      break;
  }

  // Dimensioni contenitore proporzionali all'icona
  const containerSize = size * 2.2;

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, bgStyle, { width: containerSize, height: containerSize }]}
      className={`${containerClasses} ${className || ''}`}
      {...props}
    >
      <Ionicons name={icon} size={size} color={iconColor} />
    </AnimatedPressable>
  );
};
