import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SetupEntityCard } from '../../../../shared/components/SetupEntityCard';
import { Typography } from '../../../../shared/components/Typography';
import { Transport } from '../../../../domain/trip/models/trip-setup.model';
import { getTransportModeMeta } from '../transport-mode.constants';

interface TransportCardProps {
  transport: Transport;
  onPress?: () => void;
  onDelete?: () => void;
}

const formatDateTime = (date: Date) =>
  date.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Card riusabile per un `Transport` — usata sia nella lista
 * (`app/trip/[id]/transport/index.tsx`) sia potenzialmente altrove (es. un
 * futuro riepilogo del Trip Setup Wizard). Puramente presentazionale: nessun
 * calcolo di dominio, riceve `transport` già pronto. Il "guscio" (icona,
 * riga categoria, badge confermato, elimina) è condiviso con
 * `AccommodationCard` tramite `SetupEntityCard`.
 */
export const TransportCard: React.FC<TransportCardProps> = ({ transport, onPress, onDelete }) => {
  const { label, icon } = getTransportModeMeta(transport.mode);

  return (
    <SetupEntityCard
      icon={icon}
      label={label}
      confirmed={transport.confirmed}
      onPress={onPress}
      onDelete={onDelete}
      deleteAccessibilityLabel={`Elimina trasporto ${transport.origin || ''} verso ${transport.destination}`.trim()}
    >
      <View className="flex-row items-center mt-1">
        <Typography variant="bodySemibold" className="text-gray-900 flex-1" numberOfLines={1}>
          {transport.origin || '—'}
        </Typography>
        <Ionicons name="arrow-forward" size={14} color="#9CA3AF" style={{ marginHorizontal: 6 }} />
        <Typography variant="bodySemibold" className="text-gray-900 flex-1 text-right" numberOfLines={1}>
          {transport.destination}
        </Typography>
      </View>

      <View className="flex-row items-center justify-between mt-1.5">
        <Typography variant="caption" className="text-gray-500">
          {formatDateTime(new Date(transport.departureDate))}
        </Typography>
        {transport.arrivalDate ? (
          <Typography variant="caption" className="text-gray-500">
            → {formatDateTime(new Date(transport.arrivalDate))}
          </Typography>
        ) : null}
      </View>

      {transport.bookingReference ? (
        <View className="flex-row items-center mt-2">
          <Ionicons name="pricetag-outline" size={13} color="#6B7280" />
          <Typography variant="caption" className="text-gray-500 ml-1.5">
            {transport.bookingReference}
          </Typography>
        </View>
      ) : null}

      {transport.notes ? (
        <Typography variant="caption" className="text-gray-400 mt-1.5" numberOfLines={2}>
          {transport.notes}
        </Typography>
      ) : null}
    </SetupEntityCard>
  );
};
