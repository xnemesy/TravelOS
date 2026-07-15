import React, { useState, useEffect } from 'react';
import { View, Pressable, Modal, ScrollView, Image, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, withSequence } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../../shared/components/Typography';
import { TravelServices } from '../../../domain/providers/TravelServices';
import { PlaceRef } from '../../../core/engines/types/context.types';
import { useTravelContext } from '../../../shared/hooks';

export interface InspirationWizardModalProps {
  visible: boolean;
  onClose: () => void;
  tripId: string;
  destinationName?: string;
  onComplete: (selectedPlaces: PlaceRef[], styleId: string) => Promise<void>;
}

const TRAVEL_STYLES = [
  { id: 'culture', icon: '🏛', title: 'Cultura', desc: 'Musei, monumenti e storia' },
  { id: 'food', icon: '🍝', title: 'Food & Wine', desc: 'Esperienze gastronomiche e caffè storici' },
  { id: 'relax', icon: '🌿', title: 'Relax & Parchi', desc: 'Ritmi lenti, terme e giardini' },
  { id: 'photography', icon: '📷', title: 'Fotografia', desc: 'Golden hour, panorami e scorci' },
  { id: 'family', icon: '👨‍👩‍👧', title: 'Famiglia', desc: 'Meno spostamenti, tappe divertenti' },
  { id: 'express', icon: '⚡', title: 'Express', desc: 'I grandi Must-See senza perdite di tempo' },
];

export const InspirationWizardModal: React.FC<InspirationWizardModalProps> = ({
  visible,
  onClose,
  tripId,
  destinationName = 'Budapest',
  onComplete,
}) => {
  const [step, setStep] = useState<'style' | 'places' | 'building' | 'success'>('style');
  const [selectedStyle, setSelectedStyle] = useState<string>('culture');
  const [catalogPlaces, setCatalogPlaces] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [buildProgress, setBuildProgress] = useState<number>(0);

  const pulseScale = useSharedValue(1);
  const rotateDeg = useSharedValue(0);

  const context = useTravelContext(tripId);
  const assignedPlaceIds = new Set(
    context.timeline?.days?.flatMap((day) => day.places?.map((p) => p.id) || []) || []
  );

  useEffect(() => {
    if (visible) {
      setStep('style');
      setSelectedIds(new Set());
      setBuildProgress(0);
    }
  }, [visible]);

  useEffect(() => {
    if (step === 'building') {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      rotateDeg.value = withRepeat(
        withSequence(
          withTiming(5, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
          withTiming(-5, { duration: 1200, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = 1;
      rotateDeg.value = 0;
    }
  }, [step]);

  const animatedBadgeStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulseScale.value },
      { rotate: `${rotateDeg.value}deg` }
    ],
  }));

  const handleSelectStyle = async (styleId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStyle(styleId);
    setLoading(true);
    setStep('places');

    try {
      const places = await TravelServices.editorial().getCuratedCatalog(destinationName, styleId);
      const unassigned = places.filter(p => !assignedPlaceIds.has(p.id));
      setCatalogPlaces(unassigned);
      const initialIds = new Set(unassigned.slice(0, 4).map(p => p.id));
      setSelectedIds(initialIds);
    } catch (err) {
      console.warn('[InspirationWizardModal] Error loading curated catalog:', err);
      setCatalogPlaces([]);
    } finally {
      setLoading(false);
    }
  };

  const togglePlaceSelection = (placeId: string) => {
    Haptics.selectionAsync();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(placeId)) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      return next;
    });
  };

  const handleCreateJourney = async () => {
    if (selectedIds.size === 0 || submitting) return;
    setSubmitting(true);
    setStep('building');
    setBuildProgress(0);

    try {
      const steps = 6;
      for (let i = 1; i <= steps; i++) {
        await new Promise(resolve => setTimeout(resolve, 400));
        setBuildProgress(i);
        try {
          if (i % 2 === 0) {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        } catch (e) {
          // Ignora errori Haptics su simulatori o piattaforme non supportate
        }
      }

      const chosenPlaces = catalogPlaces.filter(p => selectedIds.has(p.id));
      await onComplete(chosenPlaces, selectedStyle);
      setStep('success');
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {
        // Ignora errori Haptics
      }
    } catch (err) {
      console.warn('[InspirationWizardModal] Error completing wizard:', err);
      // Ripristina lo stato in caso di errore per evitare il freeze della UI
      setStep('places');
    } finally {
      setSubmitting(false);
    }
  };

  const isBuilding = step === 'building';
  const isSuccess = step === 'success';
  const isFullscreen = isBuilding || isSuccess;

  const getLoaderTitle = () => {
    if (buildProgress <= 1) return "Sto analizzando i luoghi...";
    if (buildProgress === 2) return "Sto creando il miglior percorso...";
    if (buildProgress === 3) return "Sto bilanciando le energie...";
    if (buildProgress === 4) return "Sto inserendo pause strategiche...";
    if (buildProgress === 5) return "Sto cercando il momento migliore...";
    return "Sto creando il tuo itinerario...";
  };

  return (
    <Modal visible={visible} transparent={!isFullscreen} animationType="slide" onRequestClose={onClose}>
      {isBuilding ? (
        <View className="flex-1 bg-white items-center justify-center p-8">
          <Animated.View style={animatedBadgeStyle} className="w-20 h-20 bg-[#4A6741]/10 rounded-full items-center justify-center mb-8 shadow-sm">
            <Typography variant="h2" className="text-3xl text-[#4A6741]">✨</Typography>
          </Animated.View>
          
          <Typography variant="h2" className="text-gray-900 mb-8 text-center text-2xl font-bold tracking-tight h-16">
            {getLoaderTitle()}
          </Typography>
          
          <View className="w-full max-w-xs space-y-4 px-2 mb-8">
            {[
              "Analizzo i luoghi",
              "Ottimizzo il percorso",
              "Bilancio le energie",
              "Cerco il momento migliore",
              "Inserisco pause strategiche",
              "Creo il tuo itinerario"
            ].map((text, idx) => {
              const active = buildProgress >= idx + 1;
              return (
                <View key={idx} className="flex-row items-center py-1">
                  <Ionicons 
                    name={active ? "checkmark-circle" : "ellipse-outline"} 
                    size={22} 
                    color={active ? "#10B981" : "#D1D5DB"} 
                  />
                  <Typography variant="body" className={`ml-4 text-[16px] ${active ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                    {text}
                  </Typography>
                </View>
              );
            })}
          </View>
          
          <ActivityIndicator size="large" color="#4A6741" className="mt-6" />
        </View>
      ) : isSuccess ? (
        <View className="flex-1 bg-white items-center justify-center p-8">
          <View className="w-20 h-20 bg-[#4A6741]/10 rounded-full items-center justify-center mb-6 shadow-sm">
            <Typography variant="h2" className="text-3xl text-[#4A6741]">✨</Typography>
          </View>
          
          <Typography variant="h2" className="text-gray-900 mb-2 text-center text-2xl font-bold tracking-tight">
            Itinerario pronto
          </Typography>
          <Typography variant="body" className="text-gray-500 mb-8 text-center text-[16px]">
            Abbiamo organizzato la tua giornata.
          </Typography>
          
          <View className="w-full max-w-xs bg-gray-50 p-6 rounded-3xl mb-8 space-y-3.5 border border-gray-100 shadow-sm">
            <View className="flex-row items-center">
              <Typography variant="body" className="text-[#4A6741] mr-3 font-bold">•</Typography>
              <Typography variant="bodySemibold" className="text-gray-800 text-[15px]">
                {((selectedIds.size * 1.4).toFixed(1)).replace('.', ',')} km a piedi
              </Typography>
            </View>
            <View className="flex-row items-center">
              <Typography variant="body" className="text-[#4A6741] mr-3 font-bold">•</Typography>
              <Typography variant="bodySemibold" className="text-gray-800 text-[15px]">
                {selectedIds.size} attrazioni selezionate
              </Typography>
            </View>
            <View className="flex-row items-center">
              <Typography variant="body" className="text-[#4A6741] mr-3 font-bold">•</Typography>
              <Typography variant="bodySemibold" className="text-gray-800 text-[15px]">
                {selectedIds.size > 3 ? '3 pause' : '2 pause'} strategiche
              </Typography>
            </View>
            <View className="flex-row items-center">
              <Typography variant="body" className="text-[#4A6741] mr-3 font-bold">•</Typography>
              <Typography variant="bodySemibold" className="text-gray-800 text-[15px]">
                percorso ottimizzato per luce e orari
              </Typography>
            </View>
          </View>
          
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              onClose();
            }}
            className="w-full max-w-xs bg-[#4A6741] py-4 rounded-full items-center shadow-md shadow-[#4A6741]/20 active:opacity-90"
          >
            <Typography variant="bodySemibold" className="text-white text-[16px] font-semibold">
              Visualizza giornata
            </Typography>
          </Pressable>
        </View>
      ) : (
        <View className="flex-1 bg-black/50 justify-end">
          <View className="bg-white rounded-t-3xl h-[85%] overflow-hidden">
          {/* Handle per trascinare / indicatore */}
          <View className="w-12 h-1 bg-gray-200 rounded-full self-center mt-3 mb-2" />
          
          {/* Header */}
          <View className="px-6 py-3 flex-row justify-between items-center border-b border-gray-100">
            <View>
              <Typography variant="captionMedium" className="text-[#4A6741] uppercase tracking-wider">
                {step === 'style' ? 'Step 1 di 2 • Ispirazione' : 'Step 2 di 2 • Catalogo Editoriale'}
              </Typography>
              <Typography variant="h2" className="text-gray-900 text-2xl">
                {step === 'style' ? 'Che giornata vuoi?' : `Ispirazioni per ${destinationName}`}
              </Typography>
            </View>
            <Pressable onPress={onClose} className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
              <Ionicons name="close" size={20} color="#374151" />
            </Pressable>
          </View>

          {/* Body */}
          <View className="flex-1 px-6 pt-4">
            {step === 'style' ? (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Typography variant="body" className="text-gray-500 mb-4">
                  Scegli il tema di oggi. Il catalogo editoriale di Travel OS selezionerà le tappe perfette per ispirarti.
                </Typography>
                
                {TRAVEL_STYLES.map(style => (
                  <Pressable
                    key={style.id}
                    onPress={() => handleSelectStyle(style.id)}
                    className="flex-row items-center p-4 mb-3 border border-gray-100 rounded-2xl active:bg-gray-50 bg-[#FAF9F6] border-gray-200/60 shadow-sm"
                  >
                    <View className="w-12 h-12 bg-white rounded-full items-center justify-center mr-4 shadow-sm">
                      <Typography variant="h2" className="text-2xl">{style.icon}</Typography>
                    </View>
                    <View className="flex-1">
                      <Typography variant="bodySemibold" className="text-gray-900 text-base mb-0.5">
                        {style.title}
                      </Typography>
                      <Typography variant="captionMedium" className="text-gray-500 text-xs">
                        {style.desc}
                      </Typography>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#4A6741" />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View className="flex-1">
                <View className="flex-row items-center justify-between mb-3">
                  <Typography variant="body" className="text-gray-500 text-xs">
                    Seleziona le tappe da aggiungere alla tua Libreria.
                  </Typography>
                  <Pressable onPress={() => setStep('style')}>
                    <Typography variant="captionMedium" className="text-[#4A6741] text-xs underline">
                      Cambia stile
                    </Typography>
                  </Pressable>
                </View>

                {loading ? (
                  <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="large" color="#4A6741" />
                    <Typography variant="bodySemibold" className="text-gray-600 mt-4">
                      Consultando il catalogo curato...
                    </Typography>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                    {catalogPlaces.map(place => {
                      const isSelected = selectedIds.has(place.id);
                      return (
                        <Pressable
                          key={place.id}
                          onPress={() => togglePlaceSelection(place.id)}
                          className={`flex-row p-3 mb-3 rounded-2xl border transition-all ${
                            isSelected 
                              ? 'bg-[#4A6741]/5 border-[#4A6741] shadow-sm' 
                              : 'bg-white border-gray-100 opacity-70'
                          }`}
                        >
                          <Image
                            source={{ uri: place.heroImage }}
                            className="w-20 h-20 rounded-xl bg-gray-200 mr-3.5"
                          />
                          <View className="flex-1 justify-center">
                            <View className="flex-row items-center justify-between">
                              <Typography variant="captionMedium" className="text-[#4A6741] uppercase text-[10px]">
                                {place.category}
                              </Typography>
                              {place.rating && (
                                <View className="flex-row items-center bg-amber-50 px-1.5 py-0.5 rounded">
                                  <Ionicons name="star" size={11} color="#D97706" />
                                  <Typography variant="captionSemibold" className="text-amber-800 ml-1 text-[10px]">
                                    {place.rating}
                                  </Typography>
                                </View>
                              )}
                            </View>

                            <Typography variant="bodySemibold" className="text-gray-900 text-base mt-0.5 mb-1" numberOfLines={1}>
                              {place.name}
                            </Typography>
                            
                            <Typography variant="caption" className="text-gray-500 text-xs" numberOfLines={1}>
                              {place.formattedAddress || 'Centro storico'}
                            </Typography>
                          </View>

                          <View className="justify-center pl-2">
                            <View className={`w-6 h-6 rounded-full border items-center justify-center ${
                              isSelected ? 'bg-[#4A6741] border-[#4A6741]' : 'border-gray-300 bg-white'
                            }`}>
                              {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
                            </View>
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          {/* Footer Bottone Azione */}
          {step === 'places' && !loading && (
            <View className="p-6 bg-white border-t border-gray-100 pb-8">
              <Pressable
                onPress={handleCreateJourney}
                disabled={selectedIds.size === 0 || submitting}
                className={`w-full py-4 rounded-full items-center justify-center flex-row shadow-md ${
                  selectedIds.size > 0 && !submitting ? 'bg-[#4A6741] active:bg-[#3d5535]' : 'bg-gray-200'
                }`}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Typography variant="bodySemibold" className="text-white text-base mr-2">
                      ✨ Crea la mia giornata
                    </Typography>
                    <View className="bg-white/20 px-2.5 py-0.5 rounded-full">
                      <Typography variant="captionSemibold" className="text-white text-xs">
                        {selectedIds.size} {selectedIds.size === 1 ? 'luogo' : 'luoghi'}
                      </Typography>
                    </View>
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </View>
      )}
    </Modal>
  );
};
