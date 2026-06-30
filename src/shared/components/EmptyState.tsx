import React from 'react';
import { View, ViewProps } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from './Typography';
import { Button } from './Button';

interface EmptyStateProps extends ViewProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  actionLabel,
  onAction,
  className,
  ...props 
}) => {
  return (
    <Animated.View 
      entering={FadeIn.delay(100).duration(400)} 
      className={`flex-1 justify-center items-center px-8 ${className || ''}`}
      {...props}
    >
      <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-6">
        <Ionicons name={icon} size={40} color="#C6C6C8" />
      </View>
      
      <Typography variant="h3" align="center" className="mb-2">
        {title}
      </Typography>
      
      <Typography variant="body" color="secondary" align="center" className="mb-8">
        {description}
      </Typography>
      
      {actionLabel && onAction && (
        <Button 
          label={actionLabel} 
          icon="add" 
          onPress={onAction} 
        />
      )}
    </Animated.View>
  );
};
