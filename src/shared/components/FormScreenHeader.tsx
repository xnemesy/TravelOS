import React from 'react';
import { View, Pressable } from 'react-native';
import { Typography } from './Typography';

interface FormScreenHeaderProps {
  /** Se omesso, mostra solo il pulsante a sinistra (es. schermata di errore "non trovato"). */
  title?: string;
  onLeftPress: () => void;
  leftLabel?: string;
}

/**
 * Header comune "azione a sinistra + titolo centrato" — estratto perché
 * duplicato identico nel wizard e negli screen add/edit di Transport e
 * Accommodation (5 punti). Il caso senza `title` copre la variante minimale
 * usata dagli stati "entità non trovata".
 */
export const FormScreenHeader: React.FC<FormScreenHeaderProps> = ({ title, onLeftPress, leftLabel = 'Annulla' }) => (
  <View className={`flex-row items-center px-5 py-4 border-b border-gray-100 ${title ? 'justify-between' : ''}`}>
    <Pressable onPress={onLeftPress} className="p-2 -ml-2" accessibilityRole="button" accessibilityLabel={leftLabel}>
      <Typography variant="bodySemibold" className="text-gray-500">{leftLabel}</Typography>
    </Pressable>
    {title ? (
      <>
        <Typography variant="h3" className="text-gray-900">{title}</Typography>
        <View className="w-16" />
      </>
    ) : null}
  </View>
);
