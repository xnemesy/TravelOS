import React, { useEffect, useState } from 'react';
import { View, ScrollView, Pressable, Platform, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Typography } from '../../../../shared/components/Typography';
import { TextField } from '../../../../shared/components/forms/TextField';
import { ChipSelector } from '../../../../shared/components/forms/ChipSelector';
import {
  searchDestinations,
  DestinationCatalogItem,
  getDestinationByName,
} from '../../../places/catalog/destinations.catalog';
import { TravelServices } from '../../../../domain/providers/TravelServices';
import { StepComponentProps } from '../wizard.types';

const EMOJI_OPTIONS = ['✈️', '🏝️', '🏔️', '🏙️', '🎒', '🏛️', '🛳️', '🚂', '🌍', '⛺', '🗿', '🏰', '🇭🇺', '🇯🇵', '🇫🇷', '🇮🇹', '🇺🇸', '🇪🇸', '🇬🇧', '🇮🇸'];
const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'HUF'];
const CURRENCY_CHIP_OPTIONS = CURRENCY_OPTIONS.map((c) => ({ value: c, label: c }));

const formatDate = (date: Date) =>
  date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Step 1 — Informazioni di base. Porta la stessa esperienza di
 * destinazione/cover automation/date già presente nel vecchio
 * `app/trip/create.tsx` (autocomplete dal catalogo editoriale, ricerca cover
 * reale via SIP, date picker nativi platform-branched) riorganizzata come
 * step controllato del wizard — nessuna funzionalità rimossa, solo
 * ricollocata. La chiamata diretta a `TravelServices.places()` per la cover
 * automation preserva il pattern preesistente (non una nuova violazione).
 */
export const BasicInfoStep: React.FC<StepComponentProps> = ({ formState, errors, onChange }) => {
  const { emoji, title, destination, currency, startDate, endDate, coverImageUrl } = formState;

  const [suggestions, setSuggestions] = useState<DestinationCatalogItem[]>([]);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<DestinationCatalogItem | null>(() =>
    getDestinationByName(destination) || null
  );
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  useEffect(() => {
    if (selectedCatalogItem && !selectedCatalogItem.id.startsWith('custom-')) {
      return;
    }
    if (destination.trim().length >= 3) {
      const delayDebounce = setTimeout(async () => {
        try {
          const res = await TravelServices.places().searchPlaces(destination);
          if (res && res[0] && res[0].coverImageUrl) {
            onChange({ coverImageUrl: res[0].coverImageUrl });
          }
        } catch (e) {
          // Degradazione silenziosa a nessuna cover, coerente con il SIP (PRODUCT_PRINCIPLES.md §5)
        }
      }, 500);
      return () => clearTimeout(delayDebounce);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, selectedCatalogItem]);

  const handleDestinationChange = (text: string) => {
    onChange({ destination: text });
    if (text.trim().length >= 2) {
      const results = searchDestinations(text);
      const hasExactMatch = results.some((r) => r.name.toLowerCase() === text.trim().toLowerCase());
      if (!hasExactMatch) {
        const customItem: DestinationCatalogItem = {
          id: `custom-${Date.now()}`,
          name: text.trim(),
          country: 'Destinazione personalizzata',
          flag: '📍',
          currency: 'EUR',
          heroImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
          tagline: 'Crea un viaggio per questa destinazione',
          timezone: 'GMT+1',
          coordinates: undefined,
        };
        setSuggestions([customItem, ...results]);
      } else {
        setSuggestions(results);
      }

      const exact = getDestinationByName(text);
      setSelectedCatalogItem(exact || null);
    } else {
      setSuggestions([]);
      setSelectedCatalogItem(null);
    }
  };

  const handleSelectDestination = (item: DestinationCatalogItem) => {
    setSelectedCatalogItem(item);
    setSuggestions([]);
    onChange({
      destination: item.name,
      currency: item.currency,
      emoji: item.flag,
      title: !title.trim() || title.startsWith('Viaggio a ') ? `Viaggio a ${item.name}` : title,
    });
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
      {/* Destinazione */}
      <View className="mb-6">
        <TextField
          label="Destinazione principale *"
          value={destination}
          onChangeText={handleDestinationChange}
          placeholder="es. Budapest, Kyoto, Parigi, Roma..."
          leftIcon="search"
          error={errors.destination}
          rightIcon={destination.length > 0 ? 'close-circle' : undefined}
          onRightIconPress={destination.length > 0 ? () => handleDestinationChange('') : undefined}
        />

        {suggestions.length > 0 && destination !== selectedCatalogItem?.name && (
          <View className="mt-2 bg-white border border-gray-200 rounded-2xl shadow-lg overflow-hidden z-50">
            {suggestions.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => handleSelectDestination(item)}
                className={`flex-row items-center p-3.5 ${
                  index < suggestions.length - 1 ? 'border-b border-gray-100' : ''
                } active:bg-green-50`}
              >
                <Typography variant="h2" className="mr-3 text-2xl">{item.flag}</Typography>
                <View className="flex-1">
                  <Typography variant="bodySemibold" className="text-gray-900 text-base">{item.name}</Typography>
                  <Typography variant="caption" className="text-gray-500">{item.country} • Valuta: {item.currency}</Typography>
                </View>
                <View className="bg-green-100 px-2.5 py-1 rounded-full flex-row items-center">
                  <Ionicons name="sparkles" size={12} color="#10B981" />
                  <Typography variant="caption" className="text-green-800 ml-1 text-xs font-bold">Cover</Typography>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {(selectedCatalogItem && !selectedCatalogItem.id.startsWith('custom-')) || coverImageUrl ? (
          <View className="mt-3 rounded-3xl overflow-hidden border border-gray-200 shadow-md bg-gray-900 h-40 relative">
            <ImageBackground
              source={{
                uri:
                  selectedCatalogItem && !selectedCatalogItem.id.startsWith('custom-')
                    ? selectedCatalogItem.heroImage
                    : coverImageUrl || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
              }}
              className="w-full h-full justify-end p-4"
              resizeMode="cover"
            >
              <View className="absolute inset-0 bg-black/40" />
              <View className="relative z-10">
                <View className="flex-row items-center mb-1.5">
                  <View className="bg-green-500 px-2 py-0.5 rounded-full flex-row items-center shadow-sm">
                    <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                    <Typography variant="captionMedium" className="text-white ml-1 text-[11px] font-bold">
                      Cover Automation
                    </Typography>
                  </View>
                </View>
                <Typography variant="h2" className="text-white font-bold text-2xl">{destination}</Typography>
              </View>
            </ImageBackground>
          </View>
        ) : (
          destination.trim().length > 1 && (
            <View className="flex-row items-center mt-2 px-1">
              <Ionicons name="sparkles" size={14} color="#10B981" />
              <Typography variant="caption" className="text-green-700 ml-1.5 font-medium">
                Copertina fotografica assegnata automaticamente
              </Typography>
            </View>
          )
        )}
      </View>

      {/* Nome viaggio */}
      <TextField
        label="Nome del viaggio *"
        value={title}
        onChangeText={(text) => onChange({ title: text })}
        placeholder={destination.trim() ? `es. Viaggio a ${destination}` : 'es. Weekend a Budapest'}
        error={errors.title}
      />

      {/* Emoji */}
      <View className="mb-6">
        <Typography variant="captionSemibold" className="text-gray-500 mb-3 uppercase tracking-wider">
          Scegli un'icona
        </Typography>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
          <View className="flex-row gap-2 px-1" accessibilityRole="radiogroup" accessibilityLabel="Icona del viaggio">
            {EMOJI_OPTIONS.map((item) => (
              <Pressable
                key={item}
                onPress={() => onChange({ emoji: item })}
                accessibilityRole="radio"
                accessibilityState={{ selected: emoji === item }}
                accessibilityLabel={`Icona ${item}`}
                className={`w-12 h-12 rounded-2xl items-center justify-center border ${
                  emoji === item ? 'bg-green-50 border-green-600 scale-105' : 'bg-gray-50 border-gray-200'
                }`}
              >
                <Typography variant="h2" className="text-2xl">{item}</Typography>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Date */}
      <View className="mb-6 bg-gray-50 border border-gray-200 rounded-3xl p-5">
        <Typography variant="captionSemibold" className="text-gray-500 mb-4 uppercase tracking-wider">
          Date del viaggio
        </Typography>

        <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-gray-200">
          <View className="flex-1">
            <Typography variant="caption" className="text-gray-500">Partenza</Typography>
            {Platform.OS === 'android' ? (
              <Pressable onPress={() => setShowStartPicker(true)} className="py-1">
                <Typography variant="bodySemibold" className="text-gray-900 text-lg">{formatDate(startDate)}</Typography>
              </Pressable>
            ) : (
              <View className="items-start mt-1">
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display="default"
                  onChange={(_, date) => {
                    if (!date) return;
                    const patch: Partial<{ startDate: Date; endDate: Date }> = { startDate: date };
                    if (date > endDate) {
                      const newEnd = new Date(date);
                      newEnd.setDate(newEnd.getDate() + 3);
                      patch.endDate = newEnd;
                    }
                    onChange(patch);
                  }}
                />
              </View>
            )}
          </View>
        </View>

        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Typography variant="caption" className="text-gray-500">Ritorno</Typography>
            {Platform.OS === 'android' ? (
              <Pressable onPress={() => setShowEndPicker(true)} className="py-1">
                <Typography variant="bodySemibold" className="text-gray-900 text-lg">{formatDate(endDate)}</Typography>
              </Pressable>
            ) : (
              <View className="items-start mt-1">
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display="default"
                  minimumDate={startDate}
                  onChange={(_, date) => date && onChange({ endDate: date })}
                />
              </View>
            )}
          </View>
        </View>

        {Platform.OS === 'android' && showStartPicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(_, date) => {
              setShowStartPicker(false);
              if (!date) return;
              const patch: Partial<{ startDate: Date; endDate: Date }> = { startDate: date };
              if (date > endDate) {
                const newEnd = new Date(date);
                newEnd.setDate(newEnd.getDate() + 3);
                patch.endDate = newEnd;
              }
              onChange(patch);
            }}
          />
        )}

        {Platform.OS === 'android' && showEndPicker && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display="default"
            minimumDate={startDate}
            onChange={(_, date) => {
              setShowEndPicker(false);
              if (date) onChange({ endDate: date });
            }}
          />
        )}
        {errors.endDate ? (
          <Typography variant="caption" className="text-red-500 mt-2">{errors.endDate}</Typography>
        ) : null}
      </View>

      {/* Valuta */}
      <View className="mb-4">
        <Typography variant="captionSemibold" className="text-gray-500 mb-3 uppercase tracking-wider">
          Valuta di riferimento
        </Typography>
        <ChipSelector
          options={CURRENCY_CHIP_OPTIONS}
          value={currency}
          onChange={(value) => onChange({ currency: value })}
          accessibilityLabel="Valuta di riferimento"
        />
      </View>
    </ScrollView>
  );
};
