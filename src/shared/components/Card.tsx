import React from 'react';
import { View, ViewProps, Pressable, PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { radius } from '../../core/theme/radius';

interface CardProps extends ViewProps {
  onPress?: PressableProps['onPress'];
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'elevated' | 'outlined' | 'flat';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const Card: React.FC<CardProps> = ({ 
  children, 
  onPress, 
  padding = 'md',
  variant = 'elevated',
  className,
  style,
  ...props 
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = (e: any) => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      scale.value = withSpring(0.97, { stiffness: 400, damping: 25 });
    }
    // Forward the event if there was an original onPressIn (though Card doesn't expose it directly yet)
  };

  const handlePressOut = () => {
    if (onPress) scale.value = withSpring(1, { stiffness: 400, damping: 25 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  let paddingClass = '';
  switch (padding) {
    case 'none': paddingClass = 'p-0'; break;
    case 'sm': paddingClass = 'p-3'; break;
    case 'md': paddingClass = 'p-5'; break;
    case 'lg': paddingClass = 'p-6'; break;
  }

  let variantClass = '';
  switch (variant) {
    case 'elevated':
      variantClass = 'bg-card shadow-sm border border-border-light';
      break;
    case 'outlined':
      variantClass = 'bg-transparent border border-border-light';
      break;
    case 'flat':
      variantClass = 'bg-gray-50'; // TODO: or subtle brand bg
      break;
  }

  const combinedStyles = [
    { borderRadius: radius.xl },
    animatedStyle,
    style
  ];

  const Container = onPress ? AnimatedPressable : Animated.View;
  const pressableProps = onPress ? { onPress, onPressIn: handlePressIn, onPressOut: handlePressOut } : {};

  return (
    <Container
      style={combinedStyles}
      className={`overflow-hidden ${variantClass} ${paddingClass} ${className || ''}`}
      {...pressableProps}
      {...props}
    >
      {children}
    </Container>
  );
};
