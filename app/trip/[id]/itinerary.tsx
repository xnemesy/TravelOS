import React, { useState, useEffect } from 'react';
import { View, Pressable, StatusBar, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import { Typography } from '../../../src/shared/components/Typography';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { useTimeline, useTravelContext } from '../../../src/shared/hooks';
import { formatDistance } from '../../../src/shared/utils/distance.utils';
import { timelineEngine, placesEngine } from '../../../src/core/engines';
import { PlaceRef } from '../../../src/core/engines/types/context.types';
import { OptimizationReportFormatter } from '../../../src/features/itinerary/utils/OptimizationReportFormatter';
import { usePlannerStore } from '../../../src/features/itinerary/store/planner.store';
import { useTripStore } from '../../../src/features/trips/store/trip.store';
import { InspirationWizardModal } from '../../../src/features/itinerary/components/InspirationWizardModal';
import { SmartSlotFillingModal } from '../../../src/features/itinerary/components/SmartSlotFillingModal';
import { useToastStore } from '../../../src/shared/store/useToastStore';
const getNarrativeSeparator = (place: any, index: number) => {
  if (index === 0 && place.category !== 'breakfast') return '☀️ Inizia la giornata';
  if (place.category === 'breakfast') return '☕ Colazione';
  if (place.role === 'hero_experience' || place.role === 'hero') return '✨ Esperienza principale';
  if (place.category === 'lunch') return '🍝 Pausa pranzo';
  if (place.role === 'sunset' || place.category === 'sunset') return '🌇 Verso il tramonto';
  if (place.category === 'dinner') return '🍷 Serata locale';
  return null;
};

const TRAVEL_STYLES = [
  { id: 'culture', icon: '🏛', title: 'Cultura', desc: 'Più musei, monumenti e visite approfondite' },
  { id: 'food', icon: '🍝', title: 'Food', desc: 'Esperienze gastronomiche e pause nei momenti giusti' },
  { id: 'relax', icon: '🌿', title: 'Relax', desc: 'Poche tappe, ritmi lenti e pause più lunghe' },
  { id: 'photography', icon: '📷', title: 'Photography', desc: 'Golden hour, panorami e punti fotografici' },
  { id: 'family', icon: '👨‍👩‍👧', title: 'Family', desc: 'Meno spostamenti e tempi più rilassati' },
  { id: 'express', icon: '⚡', title: 'Express', desc: 'Massimizza ciò che puoi vedere' },
];

export default function ItineraryScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ id: string | string[]; day?: string }>();
  const globalParams = useGlobalSearchParams<{ id: string | string[]; day?: string }>();
  const idParam = localParams.id || globalParams.id;
  const dayParam = localParams.day || globalParams.day;
  const tripId = (Array.isArray(idParam) ? idParam[0] : idParam) || 'trip-budapest-2026';
  
  const { isAdvancedMode, setAdvancedMode } = usePlannerStore();
  const { days } = useTimeline(tripId);
  const context = useTravelContext(tripId);
  const trip = useTripStore((s) => s.getTripById(tripId));
  const destination = trip?.destination || context.destination || 'Destinazione';
  const activeDayNumber = dayParam ? parseInt(dayParam, 10) : (days?.[0]?.dayNumber || 1);
  const activeDay = days?.find(d => d.dayNumber === activeDayNumber);

  const [localPlaces, setLocalPlaces] = useState<PlaceRef[]>([]);
  const [availablePlaces, setAvailablePlaces] = useState<PlaceRef[]>([]);
  const [unassignedPlaces, setUnassignedPlaces] = useState<PlaceRef[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showStyleModal, setShowStyleModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showInspirationModal, setShowInspirationModal] = useState(false);
  const [swapSlotBlock, setSwapSlotBlock] = useState<PlaceRef | null>(null);
  const { success, undo } = useToastStore();

  // Sincronizza lo stato locale con i dati provenienti dal ContextEngine e carica la Libreria
  useEffect(() => {
    if (activeDay) {
      setLocalPlaces(activeDay.places);
    }
    const loadLibraryState = async () => {
      try {
        const saved = await placesEngine.getSavedPlaces(tripId);
        setAvailablePlaces(saved || []);
        
        // Trova i posti salvati ma non assegnati a nessuna giornata nella timeline
        const assignedIds = new Set(days?.flatMap(d => d.places.map(p => p.id)) || []);
        const unassigned = (saved || []).filter(p => !assignedIds.has(p.id));
        setUnassignedPlaces(unassigned);
      } catch (err) {
        console.warn('[ItineraryScreen] Error loading library state:', err);
      }
    };
    loadLibraryState();
  }, [activeDay, days, tripId]);

  // Calcolo dello Stato Contestuale dei 4 Stati UX
  const isDayAlreadyOptimized = Boolean(activeDay?.optimizationReport && (!activeDay.conflicts || activeDay.conflicts.length === 0));
  
  let actionState: 'inspire' | 'compose' | 'optimize' | 'ready' = 'optimize';
  if (localPlaces.length === 0) {
    if (unassignedPlaces.length === 0) {
      actionState = 'inspire'; // Stato 1: Giornata vuota e niente in libreria di non assegnato -> ✨ Ispirami
    } else {
      actionState = 'compose'; // Stato 2: Giornata vuota ma abbiamo luoghi in libreria -> ✨ Componi la giornata
    }
  } else if (unassignedPlaces.length > 0) {
    actionState = 'compose'; // Stato 2: Abbiamo tappe in giornata ma anche luoghi non assegnati -> ✨ Componi la giornata
  } else if (isDayAlreadyOptimized) {
    actionState = 'ready'; // Stato 4: Giornata ottimizzata -> ↻ Ricomponi
  } else {
    actionState = 'optimize'; // Stato 3: Giornata con tappe da ottimizzare -> ✨ Ottimizza con AI
  }

  const getButtonConfig = () => {
    switch (actionState) {
      case 'inspire':
        return { label: '✨ Ispirami', bg: 'bg-[#4A6741]', text: 'text-white' };
      case 'compose':
        return { label: `✨ Componi (${unassignedPlaces.length})`, bg: 'bg-[#4A6741]', text: 'text-white' };
      case 'ready':
        return { label: '↻ Ricomponi', bg: 'bg-gray-100 border border-gray-200', text: 'text-gray-700' };
      case 'optimize':
      default:
        return { label: '✨ Ottimizza con AI', bg: 'bg-gray-900', text: 'text-white' };
    }
  };
  const btnConfig = getButtonConfig();

  const getIconForCategory = (category: string) => {
    switch (category) {
      case 'breakfast': return 'cafe-outline';
      case 'lunch':
      case 'dinner':
      case 'restaurant': return 'restaurant-outline';
      case 'drinks': return 'wine-outline';
      case 'sunset': return 'partly-sunny-outline';
      case 'walk': return 'walk-outline';
      case 'hotel': return 'bed-outline';
      case 'museum': return 'color-palette-outline';
      case 'free_time': return 'leaf-outline';
      case 'landmark':
      case 'visit': return 'camera-outline';
      default: return 'map-outline';
    }
  };

  const getLabelForCategory = (category: string, name: string) => {
    if (category === 'breakfast') return 'Colazione';
    if (category === 'lunch') return 'Pranzo';
    if (category === 'dinner') return 'Cena';
    if (category === 'drinks') return 'Drink';
    if (category === 'walk') return 'Passeggiata';
    if (category === 'sunset') return 'Tramonto';
    if (category === 'free_time') return 'Tempo Libero';
    return name;
  };

  const handleMainAction = () => {
    if (actionState === 'inspire') {
      setShowInspirationModal(true);
    } else {
      setShowStyleModal(true);
    }
  };

  const handleWizardComplete = async (selectedPlaces: PlaceRef[], styleId: string) => {
    setIsOptimizing(true);
    try {
      for (const p of selectedPlaces) {
        await placesEngine.savePlace(tripId, p);
      }
      await timelineEngine.composeDayWithAvailablePlaces(tripId, activeDayNumber, selectedPlaces, styleId);
    } catch (err) {
      console.warn('[ItineraryScreen] Error completing wizard:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleOptimizeWithStyle = async (styleId: string) => {
    setShowStyleModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsOptimizing(true);
    
    try {
      if (actionState === 'compose' && unassignedPlaces.length > 0) {
        await timelineEngine.composeDayWithAvailablePlaces(tripId, activeDayNumber, unassignedPlaces, styleId);
      } else {
        await timelineEngine.optimizeDayTimeline(tripId, activeDayNumber, styleId);
      }
      setTimeout(() => setShowReportModal(true), 500);
    } catch (err) {
      console.warn('[ItineraryScreen] Error optimizing day:', err);
    } finally {
      setIsOptimizing(false);
    }
  };

  const renderWhyThisDayWorks = () => {
    if (!activeDay || localPlaces.length === 0) return null;
    const explanation = OptimizationReportFormatter.generateWhyDayWorks(localPlaces, activeDay.totalWalkDistanceMeters);
    if (!explanation) return null;

    return (
      <View className="bg-[#FAF8F5] p-5 rounded-3xl mb-6 border border-[#4A6741]/20 shadow-sm">
        <View className="flex-row items-center mb-2.5">
          <View className="w-7 h-7 rounded-full bg-[#4A6741]/15 items-center justify-center mr-2.5">
            <Typography variant="bodySemibold" className="text-sm">💡</Typography>
          </View>
          <Typography variant="h3" className="text-[#4A6741] text-[15px] font-bold tracking-tight">
            Perché questa giornata funziona
          </Typography>
        </View>
        <Typography variant="body" className="text-gray-800 text-[14px] leading-6 font-normal">
          {explanation}
        </Typography>
      </View>
    );
  };

  const onDragEnd = async ({ data }: { data: any[] }) => {
    setLocalPlaces(data);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const placeIds = data.map(p => p.id);
      await timelineEngine.reorderDayTimeline(tripId, activeDayNumber, placeIds);
    } catch (err) {
      console.warn('[ItineraryScreen] Error saving reordered timeline:', err);
    }
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<any>) => {
    const index = getIndex() ?? 0;
    const separator = getNarrativeSeparator(item, index);

    return (
      <ScaleDecorator>
        <View className="mb-5">
          {separator && (
            <View className="flex-row items-center my-3 pl-1">
              <Typography variant="captionMedium" className="text-[#4A6741] font-semibold tracking-wide uppercase text-[12px]">
                {separator}
              </Typography>
              <View className="flex-1 h-[1px] bg-[#4A6741]/20 ml-3" />
            </View>
          )}

          <Pressable
            onLongPress={item.id.startsWith('hotel-') ? undefined : drag}
            disabled={isActive || item.id.startsWith('hotel-')}
            onPress={() => {
              Haptics.selectionAsync();
              if (item.id.startsWith('hotel-')) {
                return; // L'alloggio fisso non è cliccabile né scambiabile in questo stato
              }
              if (item.id.startsWith('block-')) {
                setSwapSlotBlock(item);
              } else {
                router.push(`/trip/${tripId}/places/${item.id}` as any);
              }
            }}
            className={`flex-row bg-white rounded-3xl p-4 border ${
              isActive ? 'border-[#4A6741] shadow-lg bg-green-50/10' : 'border-gray-100 shadow-sm'
            }`}
          >
            <View className="w-14 items-center justify-center mr-3 border-r border-gray-100 pr-2">
              <Typography variant="bodySemibold" className="text-gray-900 text-sm">
                {item.calculatedStartTime || '09:00'}
              </Typography>
              <Typography variant="caption" className="text-gray-400 text-[10px] mt-0.5">
                {item.calculatedEndTime || '10:30'}
              </Typography>
            </View>

            <View className="mr-3 justify-center">
              <View className="w-12 h-12 rounded-2xl bg-[#4A6741]/10 items-center justify-center">
                <Ionicons name={getIconForCategory(item.category) as any} size={22} color="#4A6741" />
              </View>
            </View>

            <View className="flex-1 justify-center">
              <View className="flex-row items-center justify-between">
                <Typography variant="bodySemibold" className="text-gray-900 text-base flex-1 mr-2" numberOfLines={1}>
                  {getLabelForCategory(item.category, item.name)}
                </Typography>
                <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                  <Typography variant="caption" className="text-gray-600 text-[11px]">
                    {item.durationMinutes} min
                  </Typography>
                </View>
              </View>

              {item.id.startsWith('block-') && (
                <View className="mt-2 self-start bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex-row items-center">
                  <Typography variant="captionMedium" className="text-amber-700">✨ Scegli luogo</Typography>
                </View>
              )}

              {item.category === 'free_time' && !item.id.startsWith('block-') && (
                <Typography variant="captionMedium" className="text-green-700 font-medium">
                  🌿 Tempo libero {isAdvancedMode && `• ${item.durationMinutes} min`}
                </Typography>
              )}

               {item.estimatedWalkMinutes !== undefined && item.estimatedWalkMinutes > 0 && (
                <View className={`flex-row items-center mt-3 self-start px-2.5 py-1 rounded-md border ${
                  (item.distanceMeters || 0) > 3000 
                    ? 'bg-purple-50/60 border-purple-100/50' 
                    : 'bg-blue-50/60 border-blue-100/50'
                }`}>
                  <Ionicons 
                    name={(item.distanceMeters || 0) > 3000 ? "car" : "walk"} 
                    size={14} 
                    color={(item.distanceMeters || 0) > 3000 ? "#7C3AED" : "#2563EB"} 
                  />
                  <Typography 
                    variant="captionMedium" 
                    className={(item.distanceMeters || 0) > 3000 ? "text-purple-700 ml-1.5 text-[12px]" : "text-blue-700 ml-1.5 text-[12px]"}
                  >
                    {item.estimatedWalkMinutes} min {(item.distanceMeters || 0) > 3000 ? "in auto" : "a piedi"} {isAdvancedMode && `(${formatDistance(item.distanceMeters || 0)})`}
                  </Typography>
                </View>
              )}

              {isAdvancedMode && item.warnings && item.warnings.length > 0 && (
                <View className="mt-3 gap-1">
                  {item.warnings.map((w: string, idx: number) => (
                    <View key={idx} className="flex-row items-center bg-amber-50 self-start px-2.5 py-1 rounded-lg border border-amber-200">
                      <Ionicons name="warning-outline" size={14} color="#D97706" />
                      <Typography variant="captionMedium" className="text-amber-800 ml-1.5 text-[12px] font-medium">
                        {w}
                      </Typography>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Pressable>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]">
      <StatusBar barStyle="dark-content" />
      
      <View className="px-5 py-2 flex-row items-center justify-between border-b border-gray-100 pb-4">
        <Pressable onPress={() => router.back()} className="flex-row items-center">
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
          <Typography variant="bodySemibold" className="text-gray-900 ml-1">Daily Overview</Typography>
        </Pressable>
        <View className="flex-row items-center">
          <Pressable 
            onPress={() => setAdvancedMode(!isAdvancedMode)}
            className={`mr-3 px-3 py-1.5 rounded-full border ${isAdvancedMode ? 'bg-[#4A6741]/10 border-[#4A6741]' : 'border-gray-200'}`}
          >
            <Typography variant="captionMedium" className={isAdvancedMode ? 'text-[#4A6741]' : 'text-gray-500'}>
              {isAdvancedMode ? 'Avanzata' : 'Semplice'}
            </Typography>
          </Pressable>
          <Pressable 
            onPress={handleMainAction}
            disabled={isOptimizing}
            className={`${btnConfig.bg} px-4 py-2 rounded-full active:opacity-80 shadow-sm`}
          >
            <Typography variant="captionMedium" className={btnConfig.text}>
              {isOptimizing ? 'Elaborazione...' : btnConfig.label}
            </Typography>
          </Pressable>
        </View>
      </View>

      <View className="px-5 pt-6 pb-6 border-b border-gray-100 bg-white">
        {activeDay?.date && (
          <Typography variant="h2" className="text-gray-900 text-3xl mb-4">
            {new Date(activeDay.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </Typography>
        )}
        
        {activeDay?.overview && (
          <View className="flex-row flex-wrap gap-y-3">
            <View className="w-1/2 flex-row items-center">
              <Typography variant="body" className="mr-2">☀️</Typography>
              <Typography variant="bodySemibold" className="text-gray-800">{activeDay.overview.experiencesCount} esperienze</Typography>
            </View>
            <View className="w-1/2 flex-row items-center">
              <Typography variant="body" className="mr-2">⏱</Typography>
              <Typography variant="bodySemibold" className="text-gray-800">≈ {activeDay.overview.startTime} → {activeDay.overview.endTime}</Typography>
            </View>
            <View className="w-1/2 flex-row items-center">
              <Typography variant="body" className="mr-2">🚶</Typography>
              <Typography variant="bodySemibold" className="text-gray-800">{formatDistance(activeDay.totalWalkDistanceMeters || 0)}</Typography>
            </View>
            <View className="w-1/2 flex-row items-center">
              <Typography variant="body" className="mr-2">🍝</Typography>
              <Typography variant="bodySemibold" className="text-gray-800">{activeDay.overview.foodStopsCount} soste food</Typography>
            </View>
          </View>
        )}
      </View>

      {!activeDay || localPlaces.length === 0 ? (
        <EmptyState
          icon="compass-outline"
          title={actionState === 'inspire' ? "Libreria vuota" : "Nessuna tappa oggi"}
          description={
            actionState === 'inspire'
              ? "Non hai ancora salvato luoghi. Costruiamo insieme la tua giornata ideale dal catalogo editoriale!"
              : `Hai ${unassignedPlaces.length} luoghi nella libreria pronti per essere inseriti in questa giornata.`
          }
          actionLabel={btnConfig.label}
          onAction={handleMainAction}
        />
      ) : (
        <DraggableFlatList
          data={localPlaces}
          onDragEnd={onDragEnd}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListHeaderComponent={renderWhyThisDayWorks}
          containerStyle={{ flex: 1 }}
          contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={showStyleModal} transparent animationType="slide" onRequestClose={() => setShowStyleModal(false)}>
        <Pressable className="flex-1 bg-black/40 justify-end" onPress={() => setShowStyleModal(false)}>
          <View className="bg-white rounded-t-3xl p-6 shadow-xl max-h-[80%]" onStartShouldSetResponder={() => true}>
            <View className="w-12 h-1 bg-gray-200 rounded-full self-center mb-6" />
            <Typography variant="h2" className="text-gray-900 mb-2">Scegli il tuo Travel Style</Typography>
            <Typography variant="body" className="text-gray-500 mb-6">L'intelligenza di Travel OS organizzerà la tua giornata basandosi su questo stile.</Typography>
            
            <ScrollView showsVerticalScrollIndicator={false} className="mb-4">
              {TRAVEL_STYLES.map(style => (
                <Pressable
                  key={style.id}
                  onPress={() => handleOptimizeWithStyle(style.id)}
                  className="flex-row items-center p-4 mb-3 border border-gray-100 rounded-2xl active:bg-gray-50 active:border-gray-300 transition-colors"
                >
                  <View className="w-12 h-12 bg-gray-50 rounded-full items-center justify-center mr-4">
                    <Typography variant="h2">{style.icon}</Typography>
                  </View>
                  <View className="flex-1">
                    <Typography variant="bodySemibold" className="text-gray-900 text-base mb-0.5">{style.title}</Typography>
                    <Typography variant="captionMedium" className="text-gray-500">{style.desc}</Typography>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
      {/* Report Modal */}
      {activeDay?.optimizationReport && (
        <Modal visible={showReportModal} transparent animationType="fade" onRequestClose={() => setShowReportModal(false)}>
          <View className="flex-1 bg-black/60 justify-center items-center p-6">
            <View className="bg-white rounded-3xl p-6 shadow-xl w-full max-w-sm">
              <View className="w-16 h-16 bg-[#4A6741]/10 rounded-full items-center justify-center self-center mb-4">
                <Typography variant="h2" className="text-2xl">✨</Typography>
              </View>
              <Typography variant="h2" className="text-gray-900 text-center mb-1">Giornata ottimizzata</Typography>
              <Typography variant="bodySemibold" className="text-[#4A6741] text-center mb-6">
                Qualità: {activeDay.optimizationReport.quality?.score || 100}/100
                {activeDay.optimizationReport.quality ? ` • ${activeDay.optimizationReport.quality.label}` : ''}
              </Typography>
              
              <View className="space-y-3 mb-6 bg-gray-50 p-4 rounded-2xl max-h-60">
                <ScrollView showsVerticalScrollIndicator={false}>
                  {OptimizationReportFormatter.formatReport(activeDay.optimizationReport).map((item) => (
                    <View key={item.id} className="flex-row items-start mb-3">
                      <View className="w-7 h-7 rounded-full bg-green-100 items-center justify-center mr-2.5 mt-0.5">
                        <Ionicons name={item.icon as any} size={15} color="#10B981" />
                      </View>
                      <View className="flex-1">
                        <Typography variant="bodySemibold" className="text-gray-800 text-sm">{item.title}</Typography>
                        {item.description && (
                          <Typography variant="caption" className="text-gray-500 text-xs mt-0.5">{item.description}</Typography>
                        )}
                      </View>
                    </View>
                  ))}
                  {activeDay.conflicts && activeDay.conflicts.length > 0 && (
                    <View className="flex-row items-center mt-3 pt-2 border-t border-gray-200">
                      <Typography variant="body" className="w-6 text-center">⚠️</Typography>
                      <Typography variant="bodySemibold" className="text-orange-600 ml-2 flex-1">{activeDay.conflicts.length} criticità rilevate</Typography>
                    </View>
                  )}
                </ScrollView>
              </View>
              
              <Pressable 
                onPress={() => setShowReportModal(false)}
                className="bg-gray-900 w-full py-3.5 rounded-full items-center"
              >
                <Typography variant="bodySemibold" className="text-white">Fantastico</Typography>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Inspiration Wizard Modal */}
      <InspirationWizardModal
        visible={showInspirationModal}
        tripId={tripId}
        destinationName={destination}
        onClose={() => setShowInspirationModal(false)}
        onComplete={(places, styleId) => {
          setShowInspirationModal(false);
          handleWizardComplete(places, styleId);
        }}
      />

      <SmartSlotFillingModal
        visible={!!swapSlotBlock}
        slotBlock={swapSlotBlock}
        availablePlaces={availablePlaces}
        days={days || []}
        destinationName={destination}
        onClose={() => setSwapSlotBlock(null)}
        onExplore={() => {
          setSwapSlotBlock(null);
          router.push(`/trip/${tripId}/places`);
        }}
        onConfirm={async (place) => {
          const oldBlock = swapSlotBlock;
          setSwapSlotBlock(null);
          if (oldBlock) {
            // Se il luogo è un suggerimento live (non ancora salvato in libreria), lo salviamo
            const isSaved = availablePlaces.some(p => p.id === place.id);
            if (!isSaved) {
              await placesEngine.savePlace(tripId, place);
            }
            await timelineEngine.assignPlaceToTimelineSlot(tripId, activeDayNumber, oldBlock.id, place);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            undo(`${place.name} assegnato con successo.`, async () => {
              // Rollback logic
              await timelineEngine.assignPlaceToTimelineSlot(tripId, activeDayNumber, place.id, oldBlock);
              // Opzionalmente potremmo rimuovere il posto dalla libreria se era un suggerimento live,
              // ma in genere è comodo mantenerlo salvato per il futuro.
            });
          }
        }}
      />
    </SafeAreaView>
  );
}
