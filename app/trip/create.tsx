import React, { useState, useEffect } from 'react';
import { View, ScrollView, Pressable, StatusBar, KeyboardAvoidingView, Platform, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTripStore } from '../../src/features/trips/store/trip.store';
import { Typography } from '../../src/shared/components/Typography';
import { Button } from '../../src/shared/components/Button';
import { searchDestinations, DestinationCatalogItem, getDestinationByName } from '../../src/features/places/catalog/destinations.catalog';
import { TextField } from '../../src/shared/components/forms/TextField';
import { TravelServices } from '../../src/domain/providers/TravelServices';

const EMOJI_OPTIONS = ['✈️', '🏝️', '🏔️', '🏙️', '🎒', '🏛️', '🛳️', '🚂', '🌍', '⛺', '🗿', '🏰', '🇭🇺', '🇯🇵', '🇫🇷', '🇮🇹', '🇺🇸', '🇪🇸', '🇬🇧', '🇮🇸'];
const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'HUF'];

export default function CreateTripModalScreen() {
  const router = useRouter();
  const { editTripId } = useLocalSearchParams<{ editTripId?: string }>();
  const { createTrip, updateTrip, getTripById } = useTripStore();

  const isEditing = Boolean(editTripId);
  const existingTrip = editTripId ? getTripById(editTripId) : undefined;

  const [emoji, setEmoji] = useState('✈️');
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [currency, setCurrency] = useState('EUR');
  
  const [suggestions, setSuggestions] = useState<DestinationCatalogItem[]>([]);
  const [selectedCatalogItem, setSelectedCatalogItem] = useState<DestinationCatalogItem | null>(null);
  const [customCoverUrl, setCustomCoverUrl] = useState<string | null>(null);

  // Effetto per cercare la copertina reale per le destinazioni personalizzate
  useEffect(() => {
    if (selectedCatalogItem && !selectedCatalogItem.id.startsWith('custom-')) {
      setCustomCoverUrl(null);
      return;
    }
    
    if (destination.trim().length >= 3) {
      const delayDebounce = setTimeout(async () => {
        try {
          const res = await TravelServices.places().searchPlaces(destination);
          if (res && res[0] && res[0].coverImageUrl) {
            setCustomCoverUrl(res[0].coverImageUrl);
          } else {
            setCustomCoverUrl(null);
          }
        } catch (e) {
          setCustomCoverUrl(null);
        }
      }, 500);
      return () => clearTimeout(delayDebounce);
    } else {
      setCustomCoverUrl(null);
    }
  }, [destination, selectedCatalogItem]);

  const handleDestinationChange = (text: string) => {
    setDestination(text);
    if (text.trim().length >= 2) {
      const results = searchDestinations(text);
      const hasExactMatch = results.some(r => r.name.toLowerCase() === text.trim().toLowerCase());
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
          coordinates: { latitude: 0, longitude: 0 },
        };
        setSuggestions([customItem, ...results]);
      } else {
        setSuggestions(results);
      }
      
      const exact = getDestinationByName(text);
      if (exact) {
        setSelectedCatalogItem(exact);
      } else {
        setSelectedCatalogItem(null);
      }
    } else {
      setSuggestions([]);
      setSelectedCatalogItem(null);
    }
  };

  const handleSelectDestination = (item: DestinationCatalogItem) => {
    setDestination(item.name);
    setCurrency(item.currency);
    setEmoji(item.flag);
    setSelectedCatalogItem(item);
    setSuggestions([]);
    
    if (!title.trim() || title.startsWith('Viaggio a ')) {
      setTitle(`Viaggio a ${item.name}`);
    }
  };
  
  // Date state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14); // Default tra 2 settimane
    return d;
  });
  
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 17); // Default tra 2 settimane e 3 giorni
    return d;
  });

  // Android specific picker states
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditing && existingTrip) {
      setEmoji(existingTrip.emoji || '✈️');
      setTitle(existingTrip.title);
      setDestination(existingTrip.destination);
      setCurrency(existingTrip.currency || 'EUR');
      setStartDate(new Date(existingTrip.startDate));
      setEndDate(new Date(existingTrip.endDate));
      const match = getDestinationByName(existingTrip.destination);
      if (match) setSelectedCatalogItem(match);
    }
  }, [isEditing, existingTrip]);

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      setError('Inserisci un nome per il tuo viaggio.');
      return;
    }
    if (!destination.trim()) {
      setError('Specifica la destinazione.');
      return;
    }
    if (startDate > endDate) {
      setError('La data di partenza deve essere precedente alla data di ritorno.');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && editTripId) {
        await updateTrip(editTripId, {
          title: title.trim(),
          destination: destination.trim(),
          emoji,
          currency,
          startDate,
          endDate,
          coverImageUrl: customCoverUrl || undefined,
        });
      } else {
        await createTrip({
          title: title.trim(),
          destination: destination.trim(),
          emoji,
          currency,
          startDate,
          endDate,
          coverImageUrl: customCoverUrl || undefined,
        });
      }
      router.back();
    } catch (e: any) {
      setError(e.message || 'Errore durante il salvataggio');
      setIsSaving(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        {/* Header Modale */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-gray-100">
          <Pressable onPress={() => router.back()} className="p-2 -ml-2">
            <Typography variant="bodySemibold" className="text-gray-500">Annulla</Typography>
          </Pressable>
          <Typography variant="h3" className="text-gray-900">
            {isEditing ? 'Modifica viaggio' : 'Nuovo viaggio'}
          </Typography>
          <Pressable 
            onPress={handleSave} 
            disabled={isSaving}
            className={`p-2 -mr-2 ${isSaving ? 'opacity-50' : ''}`}
          >
            <Typography variant="bodySemibold" className="text-green-700 font-bold">
              {isSaving ? 'Salvataggio...' : 'Salva'}
            </Typography>
          </Pressable>
        </View>

        <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
          {error ? (
            <View className="bg-red-50 border border-red-200 p-3 rounded-2xl mb-6 flex-row items-center">
              <Ionicons name="alert-circle" size={20} color="#EF4444" className="mr-2" />
              <Typography variant="captionMedium" className="text-red-600 flex-1">{error}</Typography>
            </View>
          ) : null}

          {/* 1. Destinazione (Protagonista assoluta!) */}
          <View className="mb-6">
            <TextField
              label="Destinazione principale *"
              value={destination}
              onChangeText={handleDestinationChange}
              placeholder="es. Budapest, Kyoto, Parigi, Roma..."
              leftIcon="search"
              rightIcon={destination.length > 0 ? "close-circle" : undefined}
              onRightIconPress={destination.length > 0 ? () => handleDestinationChange('') : undefined}
            />
            {/* Suggerimenti Autocomplete dal Catalogo Editoriale */}
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

            {/* Cover Automation Preview Card */}
            {selectedCatalogItem && !selectedCatalogItem.id.startsWith('custom-') ? (
              <View className="mt-3 rounded-3xl overflow-hidden border border-gray-200 shadow-md bg-gray-900 h-40 relative">
                <ImageBackground source={{ uri: selectedCatalogItem.heroImage }} className="w-full h-full justify-end p-4" resizeMode="cover">
                  <View className="absolute inset-0 bg-black/40" />
                  <View className="relative z-10 flex-row justify-between items-end">
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center mb-1.5">
                        <View className="bg-green-500 px-2 py-0.5 rounded-full flex-row items-center shadow-sm">
                          <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                          <Typography variant="captionMedium" className="text-white ml-1 text-[11px] font-bold">
                            Cover Automation
                          </Typography>
                        </View>
                        <Typography variant="captionMedium" className="text-white/90 ml-2 font-medium">
                          {selectedCatalogItem.flag} {selectedCatalogItem.country}
                        </Typography>
                      </View>
                      <Typography variant="h2" className="text-white font-bold text-2xl">
                        {selectedCatalogItem.name}
                      </Typography>
                      <Typography variant="caption" className="text-white/80 mt-0.5" numberOfLines={1}>
                        {selectedCatalogItem.tagline || `Valuta pre-impostata: ${selectedCatalogItem.currency} • ${selectedCatalogItem.timezone}`}
                      </Typography>
                    </View>
                  </View>
                </ImageBackground>
              </View>
            ) : (customCoverUrl || (selectedCatalogItem && selectedCatalogItem.id.startsWith('custom-'))) ? (
              <View className="mt-3 rounded-3xl overflow-hidden border border-gray-200 shadow-md bg-gray-900 h-40 relative">
                <ImageBackground source={{ uri: customCoverUrl || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80' }} className="w-full h-full justify-end p-4" resizeMode="cover">
                  <View className="absolute inset-0 bg-black/40" />
                  <View className="relative z-10 flex-row justify-between items-end">
                    <View className="flex-1 pr-2">
                      <View className="flex-row items-center mb-1.5">
                        <View className="bg-green-500 px-2 py-0.5 rounded-full flex-row items-center shadow-sm">
                          <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                          <Typography variant="captionMedium" className="text-white ml-1 text-[11px] font-bold">
                            Cover Automation
                          </Typography>
                        </View>
                        <Typography variant="captionMedium" className="text-white/90 ml-2 font-medium">
                          📍 Destinazione personalizzata
                        </Typography>
                      </View>
                      <Typography variant="h2" className="text-white font-bold text-2xl">
                        {destination}
                      </Typography>
                      <Typography variant="caption" className="text-white/80 mt-0.5" numberOfLines={1}>
                        {customCoverUrl ? "Foto reale trovata tramite Google Places" : "Crea un viaggio per questa destinazione"}
                      </Typography>
                    </View>
                  </View>
                </ImageBackground>
              </View>
            ) : (
              destination.trim().length > 1 && (
                <View className="flex-row items-center mt-2 px-1">
                  <Ionicons name="sparkles" size={14} color="#10B981" />
                  <Typography variant="caption" className="text-green-700 ml-1.5 font-medium">
                    Copertina fotografica assegnata automaticamente in stile Apple Foto
                  </Typography>
                </View>
              )
            )}
          </View>

          {/* 2. Nome Viaggio */}
          <TextField
            label="Nome del viaggio *"
            value={title}
            onChangeText={setTitle}
            placeholder={destination.trim() ? `es. Viaggio a ${destination}` : "es. Weekend a Budapest, Tour del Giappone"}
          />

          {/* 3. Emoji Selector */}
          <View className="mb-6">
            <Typography variant="captionSemibold" className="text-gray-500 mb-3 uppercase tracking-wider">
              Scegli un'icona
            </Typography>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-1">
              <View className="flex-row gap-2 px-1">
                {EMOJI_OPTIONS.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setEmoji(item)}
                    className={`w-12 h-12 rounded-2xl items-center justify-center border ${
                      emoji === item 
                        ? 'bg-green-50 border-green-600 scale-105' 
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <Typography variant="h2" className="text-2xl">{item}</Typography>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* 4. Date Picker Nativi */}
          <View className="mb-6 bg-gray-50 border border-gray-200 rounded-3xl p-5">
            <Typography variant="captionSemibold" className="text-gray-500 mb-4 uppercase tracking-wider">
              Date del viaggio
            </Typography>

            {/* Partenza */}
            <View className="flex-row items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <View className="flex-1">
                <Typography variant="caption" className="text-gray-500">Partenza</Typography>
                {Platform.OS === 'android' ? (
                  <Pressable onPress={() => setShowStartPicker(true)} className="py-1">
                    <Typography variant="bodySemibold" className="text-gray-900 text-lg">
                      {formatDate(startDate)}
                    </Typography>
                  </Pressable>
                ) : (
                  <View className="items-start mt-1">
                    <DateTimePicker
                      value={startDate}
                      mode="date"
                      display="default"
                      onChange={(event, date) => {
                        if (date) {
                          setStartDate(date);
                          if (date > endDate) {
                            const newEnd = new Date(date);
                            newEnd.setDate(newEnd.getDate() + 3);
                            setEndDate(newEnd);
                          }
                        }
                      }}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Ritorno */}
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Typography variant="caption" className="text-gray-500">Ritorno</Typography>
                {Platform.OS === 'android' ? (
                  <Pressable onPress={() => setShowEndPicker(true)} className="py-1">
                    <Typography variant="bodySemibold" className="text-gray-900 text-lg">
                      {formatDate(endDate)}
                    </Typography>
                  </Pressable>
                ) : (
                  <View className="items-start mt-1">
                    <DateTimePicker
                      value={endDate}
                      mode="date"
                      display="default"
                      minimumDate={startDate}
                      onChange={(event, date) => {
                        if (date) setEndDate(date);
                      }}
                    />
                  </View>
                )}
              </View>
            </View>

            {/* Android Pickers */}
            {Platform.OS === 'android' && showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  setShowStartPicker(false);
                  if (date) {
                    setStartDate(date);
                    if (date > endDate) {
                      const newEnd = new Date(date);
                      newEnd.setDate(newEnd.getDate() + 3);
                      setEndDate(newEnd);
                    }
                  }
                }}
              />
            )}

            {Platform.OS === 'android' && showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                minimumDate={startDate}
                onChange={(event, date) => {
                  setShowEndPicker(false);
                  if (date) setEndDate(date);
                }}
              />
            )}
          </View>

          {/* 5. Valuta */}
          <View className="mb-10">
            <Typography variant="captionSemibold" className="text-gray-500 mb-3 uppercase tracking-wider">
              Valuta di riferimento
            </Typography>
            <View className="flex-row gap-2 flex-wrap">
              {CURRENCY_OPTIONS.map((curr) => (
                <Pressable
                  key={curr}
                  onPress={() => setCurrency(curr)}
                  className={`px-5 py-2.5 rounded-xl border ${
                    currency === curr 
                      ? 'bg-green-700 border-green-700' 
                      : 'bg-gray-50 border-gray-200'
                  }`}
                >
                  <Typography 
                    variant="bodySemibold" 
                    className={currency === curr ? 'text-white' : 'text-gray-700'}
                  >
                    {curr}
                  </Typography>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-12">
            <Button
              label={isSaving ? 'Salvataggio...' : (isEditing ? 'Salva Modifiche' : 'Crea Viaggio')}
              onPress={handleSave}
              disabled={isSaving}
              variant="solid"
              size="lg"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
