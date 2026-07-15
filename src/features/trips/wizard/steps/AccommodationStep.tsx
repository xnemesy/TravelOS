import React, { useState } from 'react';
import { View, ScrollView, Pressable, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../../shared/components/Typography';
import { Button } from '../../../../shared/components/Button';
import { Card } from '../../../../shared/components/Card';
import { Accommodation } from '../../../../domain/trip/models/trip-setup.model';
import { AccommodationForm } from '../../accommodation/components/AccommodationForm';
import { StepComponentProps } from '../wizard.types';

const TYPE_ICON_MAP: Record<string, keyof typeof Ionicons.glyphMap> = {
  hotel: 'business-outline',
  apartment: 'home-outline',
  resort: 'sunny-outline',
  hostel: 'bed-outline',
  bnb: 'cafe-outline',
  camping: 'bonfire-outline',
  villa: 'home-outline',
  other: 'key-outline',
};

const TYPE_LABEL_MAP: Record<string, string> = {
  hotel: 'Hotel / Albergo',
  apartment: 'Appartamento',
  resort: 'Resort',
  hostel: 'Ostello',
  bnb: 'B&B',
  camping: 'Campeggio',
  villa: 'Villa',
  other: 'Altro',
};

const formatShortDate = (date?: Date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) return '';
  return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/**
 * Step 3 — Alloggi & Pernottamenti (Opzionale).
 * Consente al viaggiatore di inserire gli alloggi prima di entrare nel Planner.
 * Completamente opzionale per evitare blocchi e rimbalzi di configurazione.
 */
export const AccommodationStep: React.FC<StepComponentProps> = ({ formState, onChange }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<Accommodation | undefined>(undefined);

  const accommodations = formState.accommodations || [];

  const handleSaveAccommodation = (data: Omit<Accommodation, 'id'>) => {
    if (editingItem) {
      const updated = accommodations.map((a) => (a.id === editingItem.id ? { ...data, id: editingItem.id } : a));
      onChange({ accommodations: updated });
    } else {
      const newId = `accommodation-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const created: Accommodation = { ...data, id: newId };
      onChange({ accommodations: [...accommodations, created] });
    }
    setShowModal(false);
    setEditingItem(undefined);
  };

  const handleDeleteAccommodation = (idToDelete?: string) => {
    const targetId = idToDelete || editingItem?.id;
    if (!targetId) return;
    onChange({ accommodations: accommodations.filter((a) => a.id !== targetId) });
    if (editingItem?.id === targetId) {
      setShowModal(false);
      setEditingItem(undefined);
    }
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="bg-green-50 border border-green-200 rounded-3xl p-4 mb-6 flex-row items-start">
          <Ionicons name="bed" size={24} color="#10B981" className="mt-0.5" />
          <View className="ml-3 flex-1">
            <Typography variant="bodySemibold" className="text-green-900 mb-0.5">
              Passaggio opzionale
            </Typography>
            <Typography variant="caption" className="text-green-800 leading-relaxed">
              Puoi configurare ora l'hotel o l'alloggio per le tue notti di viaggio, oppure proseguire direttamente: potrai aggiungere o modificare i pernottamenti quando vuoi nel Planner.
            </Typography>
          </View>
        </View>

        {accommodations.length === 0 ? (
          <Card variant="outlined" padding="lg" className="items-center py-10 mb-6 bg-gray-50/50">
            <View className="w-16 h-16 rounded-full bg-white border border-gray-200 items-center justify-center mb-3 shadow-sm">
              <Ionicons name="bed-outline" size={30} color="#6B7280" />
            </View>
            <Typography variant="bodySemibold" className="text-gray-800 text-center mb-1">
              Nessun alloggio configurato
            </Typography>
            <Typography variant="caption" className="text-gray-500 text-center max-w-xs mb-6">
              Aggiungi l'hotel o l'appartamento in cui soggiornerai per visualizzare i check-in nella tua timeline.
            </Typography>
            <Button
              label="Aggiungi Alloggio o Hotel"
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
                Alloggi confermati/previsti ({accommodations.length})
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

            {accommodations.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => {
                  setEditingItem(item);
                  setShowModal(true);
                }}
                className="bg-white border border-gray-200 rounded-3xl p-4 mb-3 shadow-sm active:opacity-80"
              >
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center flex-1 mr-2">
                    <View className="w-9 h-9 rounded-2xl bg-gray-100 items-center justify-center mr-3">
                      <Ionicons name={TYPE_ICON_MAP[item.type] || 'bed-outline'} size={18} color="#1C1C1E" />
                    </View>
                    <View className="flex-1">
                      <Typography variant="captionSemibold" className="text-gray-900" numberOfLines={1}>
                        {item.name || TYPE_LABEL_MAP[item.type] || 'Alloggio'}
                      </Typography>
                      {item.address ? (
                        <Typography variant="caption" className="text-gray-500 text-xs" numberOfLines={1}>
                          {item.address}
                        </Typography>
                      ) : null}
                    </View>
                  </View>
                  <View className="flex-row items-center">
                    <Pressable
                      onPress={() => handleDeleteAccommodation(item.id)}
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
                    <Typography variant="caption" className="text-gray-400 text-xs">Check-in</Typography>
                    <Typography variant="bodySemibold" className="text-gray-800" numberOfLines={1}>
                      {formatShortDate(item.checkIn)}
                    </Typography>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color="#9CA3AF" className="mx-2" />
                  <View className="flex-1 items-end">
                    <Typography variant="caption" className="text-gray-400 text-xs">Check-out</Typography>
                    <Typography variant="bodySemibold" className="text-gray-800" numberOfLines={1}>
                      {formatShortDate(item.checkOut)}
                    </Typography>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal Aggiunta/Modifica Alloggio */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View className="flex-1 bg-white pt-5 px-5">
          <View className="flex-row items-center justify-between pb-4 border-b border-gray-100 mb-4">
            <Typography variant="h3" className="text-xl font-bold">
              {editingItem ? 'Modifica alloggio' : 'Aggiungi alloggio'}
            </Typography>
            <Pressable onPress={() => setShowModal(false)} className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center">
              <Ionicons name="close" size={20} color="#6B7280" />
            </Pressable>
          </View>

          <AccommodationForm
            initial={editingItem}
            onSave={handleSaveAccommodation}
            onDelete={editingItem ? () => handleDeleteAccommodation(editingItem.id) : undefined}
            tripStartDate={formState.startDate}
            tripEndDate={formState.endDate}
          />
        </View>
      </Modal>
    </View>
  );
};
