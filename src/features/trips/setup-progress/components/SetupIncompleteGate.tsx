import React from 'react';
import { useRouter } from 'expo-router';
import { EmptyState } from '../../../../shared/components/EmptyState';
import { SetupProgressSection } from '../../../../domain/trip/engine/SetupCompletionEngine';

interface SetupIncompleteGateProps {
  tripId: string;
  missingSections: SetupProgressSection[];
  className?: string;
}

/**
 * Contenuto condiviso del gate "setup non completo" che blocca l'accesso al
 * Planner finché le sezioni richieste non sono compilate. Estratto da due
 * copie identiche precedentemente duplicate in `app/trip/[id]/itinerary.tsx`
 * e `TimelinePreview.tsx` — stesso comportamento, nessuna logica nuova.
 * Ogni chiamante resta responsabile del proprio "involucro" esterno (schermo
 * intero vs. card inline nella dashboard), passato via `className`.
 */
export const SetupIncompleteGate: React.FC<SetupIncompleteGateProps> = ({ tripId, missingSections, className }) => {
  const router = useRouter();

  const handleContinue = () => {
    router.push(`/trip/create?editTripId=${tripId}` as any);
  };

  return (
    <EmptyState
      icon="calendar-outline"
      title="Completa la configurazione del viaggio"
      description="Termina le informazioni richieste prima di iniziare a pianificare l'itinerario."
      actionLabel="Continua la configurazione"
      onAction={handleContinue}
      className={className}
    />
  );
};
