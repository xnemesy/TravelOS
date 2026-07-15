import React from 'react';
import { View, ScrollView } from 'react-native';
import { Typography } from '../../../../shared/components/Typography';
import { NumberStepper } from '../../../../shared/components/forms/NumberStepper';
import { StepComponentProps } from '../wizard.types';

/**
 * Step 2 — Viaggiatori. `pets` è un conteggio semplice oggi (vedi
 * `TripTravelersSchema` in `trip.model.ts`) — "future-ready" nel senso che il
 * campo esiste ed è persistito fin da ora, pronto a diventare un array di
 * profili se un bisogno reale emergerà, senza dover introdurre un campo ex novo.
 */
export const TravelersStep: React.FC<StepComponentProps> = ({ formState, errors, onChange }) => {
  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <Typography variant="caption" className="text-gray-500 mb-5">
        Quante persone (e animali) partecipano a questo viaggio?
      </Typography>

      <NumberStepper
        label="Adulti"
        value={formState.adults}
        onChange={(v) => onChange({ adults: v })}
        min={1}
        max={20}
        error={errors.adults}
      />

      <NumberStepper
        label="Bambini"
        value={formState.children}
        onChange={(v) => onChange({ children: v })}
        min={0}
        max={20}
        error={errors.children}
      />

      <NumberStepper
        label="Animali"
        helperText="Cani, gatti o altri compagni di viaggio"
        value={formState.pets}
        onChange={(v) => onChange({ pets: v })}
        min={0}
        max={10}
        error={errors.pets}
      />

      <View className="mt-2">
        <Typography variant="caption" className="text-gray-400">
          Puoi modificare questi numeri in qualsiasi momento dal riepilogo del viaggio.
        </Typography>
      </View>
    </ScrollView>
  );
};
