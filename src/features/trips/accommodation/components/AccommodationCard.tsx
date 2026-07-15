import React from 'react';
import { View, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SetupEntityCard } from '../../../../shared/components/SetupEntityCard';
import { Typography } from '../../../../shared/components/Typography';
import { Accommodation } from '../../../../domain/trip/models/trip-setup.model';
import { getAccommodationTypeMeta } from '../accommodation-type.constants';

interface AccommodationCardProps {
  accommodation: Accommodation;
  onPress?: () => void;
  onDelete?: () => void;
}

const formatDateTime = (date: Date) =>
  date.toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Card riusabile per un `Accommodation` — usata nella lista
 * (`app/trip/[id]/accommodation/index.tsx`) e riusabile altrove (es. un
 * futuro riepilogo del Trip Setup Wizard). Il "guscio" (icona, riga
 * categoria, badge confermato, elimina) è condiviso con `TransportCard`
 * tramite `SetupEntityCard`.
 */
export const AccommodationCard: React.FC<AccommodationCardProps> = ({ accommodation, onPress, onDelete }) => {
  const { label, icon } = getAccommodationTypeMeta(accommodation.type);

  return (
    <SetupEntityCard
      icon={icon}
      label={label}
      confirmed={accommodation.confirmed}
      onPress={onPress}
      onDelete={onDelete}
      deleteAccessibilityLabel={`Elimina alloggio ${accommodation.name}`}
    >
      <Typography variant="bodySemibold" className="text-gray-900 mt-1" numberOfLines={1}>
        {accommodation.name}
      </Typography>

      {accommodation.address ? (
        <Typography variant="caption" className="text-gray-500 mt-0.5" numberOfLines={1}>
          {accommodation.address}
        </Typography>
      ) : null}

      <View className="flex-row items-center justify-between mt-1.5">
        <Typography variant="caption" className="text-gray-500">
          Check-in {formatDateTime(accommodation.checkIn)}
        </Typography>
        <Typography variant="caption" className="text-gray-500">
          Check-out {formatDateTime(accommodation.checkOut)}
        </Typography>
      </View>

      <View className="flex-row items-center flex-wrap mt-2 gap-x-4 gap-y-1">
        {accommodation.bookingReference ? (
          <View className="flex-row items-center">
            <Ionicons name="pricetag-outline" size={13} color="#6B7280" />
            <Typography variant="caption" className="text-gray-500 ml-1.5">
              {accommodation.bookingReference}
            </Typography>
          </View>
        ) : null}

        {accommodation.confirmationUrl ? (
          <Pressable
            onPress={() => Linking.openURL(accommodation.confirmationUrl!)}
            className="flex-row items-center"
            hitSlop={6}
            accessibilityRole="link"
            accessibilityLabel="Apri link di conferma prenotazione"
          >
            <Ionicons name="link-outline" size={13} color="#007AFF" />
            <Typography variant="caption" color="accent" className="ml-1.5">Link prenotazione</Typography>
          </Pressable>
        ) : null}
      </View>

      {accommodation.notes ? (
        <Typography variant="caption" className="text-gray-400 mt-1.5" numberOfLines={2}>
          {accommodation.notes}
        </Typography>
      ) : null}
    </SetupEntityCard>
  );
};
