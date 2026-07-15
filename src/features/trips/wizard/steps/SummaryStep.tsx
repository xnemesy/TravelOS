import React from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Typography } from '../../../../shared/components/Typography';
import { Card } from '../../../../shared/components/Card';
import { StepComponentProps } from '../wizard.types';

const formatDate = (date: Date) =>
  date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

interface SummaryRowProps {
  label: string;
  value: string;
}

const SummaryRow: React.FC<SummaryRowProps> = ({ label, value }) => (
  <View className="flex-row items-center justify-between py-1.5">
    <Typography variant="caption" className="text-gray-500 shrink-0 mr-3">{label}</Typography>
    <Typography variant="bodySemibold" className="text-gray-900 flex-1 text-right" numberOfLines={2}>
      {value}
    </Typography>
  </View>
);

interface SummarySectionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onEdit: () => void;
  delay?: number;
  children: React.ReactNode;
}

const SummarySection: React.FC<SummarySectionProps> = ({ icon, title, onEdit, delay = 0, children }) => (
  <Animated.View entering={FadeInDown.delay(delay).duration(280)}>
    <Card variant="outlined" padding="md" className="mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <Ionicons name={icon} size={16} color="#6B7280" />
          <Typography variant="captionSemibold" className="text-gray-500 ml-2 uppercase tracking-wider">
            {title}
          </Typography>
        </View>
        <Pressable
          onPress={onEdit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Modifica ${title}`}
        >
          <Typography variant="captionSemibold" className="text-green-700">Modifica</Typography>
        </Pressable>
      </View>
      {children}
    </Card>
  </Animated.View>
);

/**
 * Step 6 — Riepilogo editabile. Legge `formState` e offre scorciatoie di
 * modifica per tutte le sezioni (0: Basics, 1: Flights, 2: Accommodations,
 * 3: Travelers, 4: Budget). Il salvataggio finale ("Termina") e l'accesso
 * diretto al Planner avvengono nel footer del wizard orchestratore.
 */
export const SummaryStep: React.FC<StepComponentProps> = ({ formState, onJumpToStep }) => {
  const nights = Math.max(
    0,
    Math.round((formState.endDate.getTime() - formState.startDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const transports = formState.transports || [];
  const accommodations = formState.accommodations || [];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      <Typography variant="caption" className="text-gray-500 mb-5">
        Controlla i dettagli prima di accedere al Planner del viaggio.
      </Typography>

      <SummarySection icon="location-outline" title="Informazioni di base" onEdit={() => onJumpToStep(0)}>
        <SummaryRow label="Viaggio" value={`${formState.emoji} ${formState.title || '—'}`} />
        <SummaryRow label="Destinazione" value={formState.destination || '—'} />
        <SummaryRow label="Partenza" value={formatDate(formState.startDate)} />
        <SummaryRow label="Ritorno" value={formatDate(formState.endDate)} />
        <SummaryRow label="Durata" value={nights === 0 ? 'Gita in giornata' : `${nights} notti`} />
        <SummaryRow label="Valuta" value={formState.currency} />
      </SummarySection>

      <SummarySection icon="airplane-outline" title="Voli & Trasporti" onEdit={() => onJumpToStep(1)} delay={30}>
        {transports.length === 0 ? (
          <Typography variant="caption" className="text-gray-400 italic py-1">
            Nessun volo o trasporto aggiunto (Opzionale)
          </Typography>
        ) : (
          transports.map((t, idx) => (
            <SummaryRow
              key={t.id || idx}
              label={t.mode === 'flight' ? 'Volo' : 'Tratta'}
              value={`${t.origin ? t.origin + ' → ' : ''}${t.destination}`}
            />
          ))
        )}
      </SummarySection>

      <SummarySection icon="bed-outline" title="Alloggi & Pernottamenti" onEdit={() => onJumpToStep(2)} delay={60}>
        {accommodations.length === 0 ? (
          <Typography variant="caption" className="text-gray-400 italic py-1">
            Nessun alloggio aggiunto (Opzionale)
          </Typography>
        ) : (
          accommodations.map((a, idx) => (
            <SummaryRow
              key={a.id || idx}
              label={a.type === 'hotel' ? 'Hotel' : 'Alloggio'}
              value={a.name || a.address || 'Confermato'}
            />
          ))
        )}
      </SummarySection>

      <SummarySection icon="people-outline" title="Viaggiatori" onEdit={() => onJumpToStep(3)} delay={90}>
        <SummaryRow label="Adulti" value={String(formState.adults)} />
        <SummaryRow label="Bambini" value={String(formState.children)} />
        <SummaryRow label="Animali" value={String(formState.pets)} />
      </SummarySection>

      <SummarySection icon="wallet-outline" title="Budget" onEdit={() => onJumpToStep(4)} delay={120}>
        <SummaryRow
          label="Tetto di spesa"
          value={formState.budgetAmount !== undefined ? `${formState.budgetAmount} ${formState.currency}` : 'Non impostato'}
        />
      </SummarySection>
    </ScrollView>
  );
};
