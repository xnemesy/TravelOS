import React, { useState } from 'react';
import { View, ScrollView, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../../shared/components/Typography';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { Transport } from '../../../../domain/trip/models/trip-setup.model';
import { TransportForm } from '../../transport/components/TransportForm';
import { StepComponentProps } from '../wizard.types';

const MODE_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  flight: 'airplane-outline',
  train: 'train-outline',
  bus: 'bus-outline',
  car: 'car-outline',
  ferry: 'boat-outline',
  other: 'compass-outline',
};

const MODE_LABEL_MAP: Record<string, string> = {
  flight: 'Volo',
  train: 'Treno',
  bus: 'Autobus',
  car: 'Auto',
  ferry: 'Traghetto',
  other: 'Altro',
};

const formatShortDate = (date?: Date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/**
 * Step 2 — Voli & Trasporti (Opzionale).
 * Consente al viaggiatore di inserire o consultare le tratte di viaggio prima di accedere
 * al Planner. La compilazione è interamente opzionale: il Planner non impone più barriere d'ingresso
 * o rimbalzi nel flusso di configurazione per questo step.
 */
export const FlightsStep: React.FC<StepComponentProps> = ({ formState, onChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Transport | undefined>(undefined);

  const transports = formState.transports || [];

  const handleSaveTransport = (data: Omit<Transport, 'id'>) => {
    if (editingItem) {
      const updated = transports.map((t) => (t.id === editingItem.id ? { ...data, id: editingItem.id } : t));
      onChange({ transports: updated });
    } else {
      const newId = `transport-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const created: Transport = { ...data, id: newId };
      onChange({ transports: [...transports, created] });
    }
    setShowModal(false);
    setEditingItem(undefined);
  };

  const handleDeleteTransport = (idToDelete?: string) => {
    const targetId = idToDelete || editingItem?.id;
    if (!targetId) return;
    onChange({ transports: transports.filter((t) => t.id !== targetId) });
    if (editingItem?.id === targetId) {
      setShowModal(false);
      setEditingItem(undefined);
    }
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="bg-green-50 border border-green-200 rounded-3xl p-4 mb-6 flex-row items-start">
          <Ionicons name="airplane" size={24} color="#10B981" className="mt-0.5" />
          <View className="ml-3 flex-1">
            <Typography variant="bodySemibold" className="text-green-900 mb-0.5">
              Passaggio opzionale
            </Typography>
            <Typography variant="caption" className="text-green-800 leading-relaxed">
              Puoi aggiungere i tuoi voli, treni o spostamenti ora, oppure proseguire subito: potrai modificarli e completarli liberamente in seguito senza mai uscire dal Planner.
            </Typography>
          </View>
        </View>

        {transports.length === 0 ? (
          <Card variant="outlined" padding="lg" className="items-center py-10 mb-6 bg-gray-50/50">
            <View className="w-16 h-16 rounded-full bg-white border border-gray-200 items-center justify-center mb-3 shadow-sm">
              <Ionicons name="airplane-outline" size={30} color="#6B7280" />
            </View>
            <Typography variant="bodySemibold" className="text-gray-800 text-center mb-1">
              Nessun volo o trasporto aggiunto
            </Typography>
            <Typography variant="caption" className="text-gray-500 text-center max-w-xs mb-6">
              Aggiungi la tratta di andata o ritorno per avere tutto a portata di mano nella tua timeline.
            </Typography>
            <Button
              label="Aggiungi Volo o Treno"
              icon="add"
              variant="outline"
              size="md"
              onPress={() => {
                setEditingItem(undefined);
                setShowModal(true);
              }}
            />
          </Card>
        ) : (
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Typography variant="captionSemibold" className="text-gray-500 uppercase tracking-wider">
                Tratte pianificate ({transports.length})
              </Typography>
              <Pressable
                onPress={() => {
                  setEditingItem(undefined);
                  setShowModal(true);
                }}
                className="flex-row items-center bg-green-50 px-3 py-1.5 rounded-full border border-green-200"
              >
                <Ionicons name="add" size={16} color="#10B981" />
                <Typography variant="captionSemibold" className="text-green-800 ml-1">
                  Aggiungi
                </Typography>
              </Pressable>
            </View>

            {transports.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setEditingItem(item);
                  setShowModal(true);
                }}
                className="bg-white border border-gray-200 rounded-3xl p-4 mb-3 shadow-sm active:opacity-80"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center">
                    <View className="w-9 h-9 rounded-2xl bg-gray-100 items-center justify-center mr-3">
                      <Ionicons name={MODE_ICON_MAP[item.mode] || 'airplane-outline'} size={18} color="#1C1C1E" />
                    </View>
                    <View>
                      <Typography variant="captionSemibold" className="text-gray-900">
                        {MODE_LABEL_MAP[item.mode] || 'Trasporto'} {item.provider ? `• ${item.provider}` : ''}
                      </Typography>
                      {item.bookingReference ? (
                        <Typography variant="caption" className="text-gray-500 text-xs">
                          Prenotazione: {item.bookingReference}
                        </Typography>
                      ) : null}
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => handleDeleteTransport(item.id)}
                      hitSlop={10}
                      className="p-1.5 mr-1"
                    >
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                    <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                  </View>
                </View>

                <View className="flex-row items-center justify-between bg-gray-50 rounded-2xl p-3 mt-1">
                  <View className="flex-1">
                    <Typography variant="caption" className="text-gray-400 text-xs">Partenza</Typography>
                    <Typography variant="bodySemibold" className="text-gray-800" numberOfLines={1}>
                      {item.origin || 'Da definire'}
                    </Typography>
                    <Typography variant="caption" className="text-gray-500 text-xs mt-0.5">
                      {formatShortDate(new Date(item.departureDate))}
                    </Typography>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color="#9CA3AF" className="mx-2" />
                  <View className="flex-1 items-end">
                    <Typography variant="caption" className="text-gray-400 text-xs">Arrivo</Typography>
                    <Typography variant="bodySemibold" className="text-gray-800" numberOfLines={1}>
                      {item.destination}
                    </Typography>
                    <Typography variant="caption" className="text-gray-500 text-xs mt-0.5">
                      {formatShortDate(new Date(item.arrivalDate || item.departureDate))}
                    </Typography>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal Aggiunta/Modifica Trasporto */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View className="flex-1 bg-white pt-5 px-5">
          <View className="flex-row items-center justify-between pb-4 border-b border-gray-100 mb-4">
            <Typography variant="h3" className="text-xl font-bold">
              {editingItem ? 'Modifica tratta' : 'Aggiungi volo o trasporto'}
            </Typography>
            <Pressable onPress={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
              <Ionicons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <TransportForm
            initial={editingItem}
            onSave={handleSaveTransport}
            onDelete={editingItem ? () => handleDeleteTransport(editingItem.id) : undefined}
            tripStartDate={formState.startDate}
            tripEndDate={formState.endDate}
          />
        </View>
      </Modal>
    </View>
  );
};
