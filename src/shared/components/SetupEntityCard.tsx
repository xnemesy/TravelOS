import React from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './Card';
import { Typography } from './Typography';

interface SetupEntityCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  /** Etichetta di categoria mostrata in alto (es. "Volo", "Hotel"). */
  label: string;
  confirmed?: boolean;
  onPress?: () => void;
  onDelete?: () => void;
  deleteAccessibilityLabel?: string;
  children: React.ReactNode;
}

/**
 * Involucro comune per le card di una entità di Trip Setup (Transport,
 * Accommodation, e le future sezioni dello stesso tipo) — estratto perché
 * il cerchio icona, la riga categoria/badge "Confermato" e il pulsante
 * elimina erano duplicati identici in `TransportCard` e `AccommodationCard`.
 * Il corpo specifico di ciascuna entità resta nel `children` del chiamante.
 */
export const SetupEntityCard: React.FC<SetupEntityCardProps> = ({
  icon,
  label,
  confirmed,
  onPress,
  onDelete,
  deleteAccessibilityLabel = 'Elimina',
  children,
}) => (
  <Card variant="elevated" padding="md" onPress={onPress} className="mb-3">
    <View className="flex-row items-start">
      <View className="w-11 h-11 rounded-2xl bg-gray-50 border border-gray-200 items-center justify-center mr-3.5">
        <Ionicons name={icon} size={20} color="#1C1C1E" />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Typography variant="captionSemibold" className="text-gray-500 uppercase tracking-wider">
            {label}
          </Typography>
          {confirmed ? (
            <View className="bg-green-100 px-2 py-0.5 rounded-full flex-row items-center">
              <Ionicons name="checkmark-circle" size={12} color="#10B981" />
              <Typography variant="caption" className="text-green-800 ml-1 text-xs font-bold">Confermato</Typography>
            </View>
          ) : null}
        </View>

        {children}
      </View>

      {onDelete ? (
        <Pressable
          onPress={onDelete}
          hitSlop={10}
          className="p-1 -mr-1 -mt-1"
          accessibilityRole="button"
          accessibilityLabel={deleteAccessibilityLabel}
        >
          <Ionicons name="trash-outline" size={18} color="#C7C7CC" />
        </Pressable>
      ) : null}
    </View>
  </Card>
);
