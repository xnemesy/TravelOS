import React from 'react';
import { View, Pressable } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Typography } from '../Typography';

export interface ChipOption<T extends string = string> {
  value: T;
  label: string;
}

export interface ChipSelectorProps<T extends string = string> {
  options: ChipOption<T>[];
  value: T | '';
  onChange: (value: T) => void;
  /** Etichetta del gruppo per lo screen reader (es. "Mezzo di trasporto"). */
  accessibilityLabel?: string;
}

/**
 * Riga di chip a selezione singola — estratta perché lo stesso identico
 * markup (Pressable + bg-green-700/bg-gray-50 su selezione) era duplicato
 * in `BasicInfoStep` (valuta), `TransportForm` (mezzo di trasporto) e
 * `AccommodationForm` (tipologia). Puramente presentazionale: chi la usa
 * resta responsabile di validazione ed etichetta "*"/errore intorno ad essa.
 */
export function ChipSelector<T extends string = string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: ChipSelectorProps<T>) {
  return (
    <View className="flex-row gap-2 flex-wrap" accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const isSelected = value === option.value;
        return (
          <Pressable
            key={option.value}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onChange(option.value);
            }}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={option.label}
            className={`px-4 py-2.5 rounded-xl border ${
              isSelected ? 'bg-green-700 border-green-700' : 'bg-gray-50 border-gray-200'
            }`}
          >
            <Typography variant="bodySemibold" className={isSelected ? 'text-white' : 'text-gray-700'}>
              {option.label}
            </Typography>
          </Pressable>
        );
      })}
    </View>
  );
}
