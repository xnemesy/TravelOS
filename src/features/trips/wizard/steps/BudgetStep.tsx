import React, { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { Typography } from '../../../../shared/components/Typography';
import { TextField } from '../../../../shared/components/forms/TextField';
import { StepComponentProps } from '../wizard.types';

// Consente solo cifre e un separatore decimale, in ingresso libero dall'utente.
const sanitizeAmountInput = (text: string) => text.replace(/[^0-9.,]/g, '');

const parseAmount = (text: string): number | undefined => {
  const normalized = text.replace(',', '.').trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * Step 3 — Budget (opzionale). A differenza di `TripPreferences.budgetLevel`
 * (ADR-018, categoria low/medium/high pensata per il Planner), questo è un
 * tetto di spesa numerico esplicito raccolto a livello di `Trip` — i due
 * concetti restano deliberatamente distinti, vedi `trip.model.ts`.
 */
export const BudgetStep: React.FC<StepComponentProps> = ({ formState, errors, onChange }) => {
  const [rawText, setRawText] = useState(formState.budgetAmount?.toString() ?? '');

  const handleChangeText = (text: string) => {
    const sanitized = sanitizeAmountInput(text);
    setRawText(sanitized);
    onChange({ budgetAmount: parseAmount(sanitized) });
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <Typography variant="caption" className="text-gray-500 mb-5">
        Vuoi impostare un tetto di spesa indicativo per questo viaggio? Puoi saltare questo passo.
      </Typography>

      <TextField
        label={`Budget stimato (${formState.currency})`}
        value={rawText}
        onChangeText={handleChangeText}
        placeholder="es. 1500"
        keyboardType="decimal-pad"
        error={errors.budgetAmount}
        helperText="Facoltativo — puoi modificarlo in qualsiasi momento."
      />

      <View className="mt-2">
        <Typography variant="caption" className="text-gray-400">
          Il budget è un riferimento personale: non blocca nessuna funzionalità del viaggio.
        </Typography>
      </View>
    </ScrollView>
  );
};
