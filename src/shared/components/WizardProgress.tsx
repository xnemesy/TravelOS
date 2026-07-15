import React from 'react';
import { View } from 'react-native';
import { Typography } from './Typography';

export interface WizardProgressStep {
  id: string;
  label: string;
}

interface WizardProgressProps {
  steps: WizardProgressStep[];
  currentIndex: number;
}

/**
 * Indicatore di progresso generico per wizard multi-step. Puramente
 * presentazionale — riceve `steps`/`currentIndex` dal chiamante, non calcola
 * né conosce alcuna regola di completamento (quella resta nel dominio, es.
 * `SetupCompletionEngine` per TripSetup). Estensibile: aggiungere uno step al
 * wizard aggiunge automaticamente un segmento qui, nessuna modifica richiesta.
 */
export const WizardProgress: React.FC<WizardProgressProps> = ({ steps, currentIndex }) => {
  const statusLabel = `Passo ${currentIndex + 1} di ${steps.length} · ${steps[currentIndex]?.label}`;

  return (
    <View className="w-full">
      <View
        className="flex-row gap-1.5 mb-2"
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={statusLabel}
        accessibilityValue={{ min: 1, max: steps.length, now: currentIndex + 1 }}
      >
        {steps.map((step, index) => (
          <View
            key={step.id}
            className={`flex-1 h-1.5 rounded-full ${
              index <= currentIndex ? 'bg-green-700' : 'bg-gray-200'
            }`}
          />
        ))}
      </View>
      <Typography variant="caption" className="text-gray-500">
        {statusLabel}
      </Typography>
    </View>
  );
};
