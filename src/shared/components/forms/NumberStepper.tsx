import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '../Typography';

export interface NumberStepperProps {
  label: string;
  helperText?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  error?: string;
}

export const NumberStepper: React.FC<NumberStepperProps> = ({
  label,
  helperText,
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  error,
}) => {
  const canDecrement = value - step >= min;
  const canIncrement = value + step <= max;

  const decrement = () => {
    if (!canDecrement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(value - step);
  };

  const increment = () => {
    if (!canIncrement) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(value + step);
  };

  return (
    <View className="mb-4 w-full">
      <View className="flex-row items-center justify-between border border-gray-200 rounded-2xl bg-gray-50 px-4 py-3">
        <View className="flex-1 pr-3">
          <Typography variant="bodySemibold" className="text-gray-900">
            {label}
          </Typography>
          {helperText ? (
            <Typography variant="caption" className="text-gray-500 mt-0.5">
              {helperText}
            </Typography>
          ) : null}
        </View>

        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={decrement}
            disabled={!canDecrement}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Diminuisci ${label}`}
            accessibilityState={{ disabled: !canDecrement }}
            className={`w-9 h-9 rounded-full items-center justify-center border ${
              canDecrement ? 'bg-white border-gray-300' : 'bg-gray-100 border-gray-200 opacity-50'
            }`}
          >
            <Ionicons name="remove" size={18} color={canDecrement ? '#1C1C1E' : '#C7C7CC'} />
          </Pressable>

          <Typography
            variant="bodySemibold"
            className="text-gray-900 min-w-[24px] text-center"
            accessibilityLabel={`${label}: ${value}`}
          >
            {value}
          </Typography>

          <Pressable
            onPress={increment}
            disabled={!canIncrement}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Aumenta ${label}`}
            accessibilityState={{ disabled: !canIncrement }}
            className={`w-9 h-9 rounded-full items-center justify-center border ${
              canIncrement ? 'bg-white border-gray-300' : 'bg-gray-100 border-gray-200 opacity-50'
            }`}
          >
            <Ionicons name="add" size={18} color={canIncrement ? '#1C1C1E' : '#C7C7CC'} />
          </Pressable>
        </View>
      </View>

      {error ? (
        <Typography variant="caption" className="text-red-500 mt-1.5 ml-1 font-medium">
          {error}
        </Typography>
      ) : null}
    </View>
  );
};
