import React from 'react';
import { Pressable, PressableProps, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Typography } from './Typography';
import { Ionicons } from '@expo/vector-icons';

export type ButtonVariant = 'solid' | 'tonal' | 'outline' | 'ghost';

interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  variant = 'solid', 
  icon,
  fullWidth = false,
  size = 'md',
  className,
  onPressIn,
  onPressOut,
  disabled,
  ...props 
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = (e: any) => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scale.value = withSpring(0.96, { stiffness: 400, damping: 25 });
    }
    if (onPressIn) onPressIn(e);
  };

  const handlePressOut = (e: any) => {
    scale.value = withSpring(1, { stiffness: 400, damping: 25 });
    if (onPressOut) onPressOut(e);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Styling
  let bgClass = '';
  let borderClass = '';
  let textColor: 'inverse' | 'primary' | 'accent' | 'secondary' = 'primary';
  let iconColor = '#000000';

  switch (variant) {
    case 'solid':
      bgClass = 'bg-primary';
      textColor = 'inverse';
      iconColor = '#FFFFFF';
      break;
    case 'tonal':
      bgClass = 'bg-blue-50'; // TODO: match brand
      textColor = 'accent';
      iconColor = '#007AFF';
      break;
    case 'outline':
      bgClass = 'bg-transparent';
      borderClass = 'border border-border-light';
      textColor = 'primary';
      iconColor = '#000000';
      break;
    case 'ghost':
      bgClass = 'bg-transparent';
      textColor = 'accent';
      iconColor = '#007AFF';
      break;
  }

  let sizeClasses = '';
  switch (size) {
    case 'sm': sizeClasses = 'px-4 py-2 rounded-lg'; break;
    case 'md': sizeClasses = 'px-6 py-3.5 rounded-xl'; break;
    case 'lg': sizeClasses = 'px-8 py-4 rounded-2xl'; break;
  }

  if (disabled) {
    bgClass = 'bg-gray-200';
    textColor = 'secondary';
    iconColor = '#8E8E93';
    borderClass = '';
  }

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[animatedStyle]}
      className={`${fullWidth ? 'w-full' : 'self-start'} ${sizeClasses} ${bgClass} ${borderClass} flex-row items-center justify-center ${className || ''}`}
      {...props}
    >
      {icon && (
        <View className="mr-2">
          <Ionicons name={icon} size={size === 'sm' ? 18 : 20} color={iconColor} />
        </View>
      )}
      <Typography variant={size === 'sm' ? 'captionMedium' : 'bodySemibold'} color={textColor}>
        {label}
      </Typography>
    </AnimatedPressable>
  );
};
