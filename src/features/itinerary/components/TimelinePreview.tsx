import React, { useState } from 'react';
import { View, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../../src/shared/components/Typography';
import { useTimeline, useTravelActions } from '../../../../src/shared/hooks';
import { formatDistance } from '../../../../src/shared/utils/distance.utils';
import { TimelineGenerator } from '../../../../src/domain/services/TimelineGenerator';
import { OptimizationReportFormatter } from '../utils/OptimizationReportFormatter';
import { TimelineDaySchedule } from '../../../../src/core/engines/types/context.types';
import { usePlannerStore } from '../../../../src/features/itinerary/store/planner.store';
import Animated, { useAnimatedStyle, withTiming, useSharedValue } from 'react-native-reanimated';
import { EmptyState } from '../../../../src/shared/components/EmptyState';
import { Swipeable } from 'react-native-gesture-handler';

const getNarrativeSeparator = (place: any, index: number) => {
  if (index === 0 && place.category !== 'breakfast') return '☀️ Inizia la giornata';
  if (place.category === 'breakfast') return '☕ Colazione';
  if (place.role === 'hero_experience' || place.role === 'hero') return '✨ Esperienza principale';
  if (place.category === 'lunch') return '🍝 Pausa pranzo';
  if (place.role === 'sunset' || place.category === 'sunset') return '🌇 Verso il tramonto';
  if (place.category === 'dinner') return '🍷 Serata locale';
  return null;
};

interface TimelinePreviewProps {
  tripId: string;
}

/**
 * ============================================================================
 * TIMELINE PREVIEW (ITINERARIO GIORNALIERO E RIORDINO)
 * ============================================================================
 * Conforme alla Regola d'Oro e alla gerarchia visuale rigorosa:
 * 1. Quality
 * 2. Health
 * 3. Suggestions
 * 4. Timeline
 * 5. Report
 */
export const TimelinePreview: React.FC<TimelinePreviewProps> = ({ tripId }) => {
  const router = useRouter();
  const { days, currentDayNumber } = useTimeline(tripId);
  const actions = useTravelActions();
  const { isAdvancedMode } = usePlannerStore();
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([currentDayNumber || 1]));

  const toggleDay = (dayNumber: number) => {
    const isCurrentlyExpanded = expandedDays.has(dayNumber);
    if (!isCurrentlyExpanded) {
      usePlannerStore.getState().setSelectedDay(dayNumber);
    }
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) {
        next.delete(dayNumber);
      } else {
        next.add(dayNumber);
      }
      return next;
    });
  };

  const currentDays = days && days.length > 0 ? days : [{ dayNumber: 1 }, { dayNumber: 2 }, { dayNumber: 3 }] as any;

  return (
    <View className="my-4">
      {/* Header con pulsante per aprire Journey Composer */}
      <View className="flex-row justify-between items-center mb-6">
        <Typography variant="h3" className="text-gray-900">Programma</Typography>
        <View className="flex-row items-center">
          <Pressable 
            onPress={() => router.push(`/trip/${tripId}/itinerary?day=${expandedDays.values().next().value || 1}` as any)}
            className="bg-gray-900 px-4 py-2 rounded-full flex-row items-center active:bg-gray-800 shadow-sm"
          >
            <Ionicons name="color-wand" size={14} color="#FFFFFF" />
            <Typography variant="captionSemibold" className="text-white ml-1.5">Composer</Typography>
          </Pressable>
        </View>
      </View>

      <View className="space-y-4">
        {currentDays.map((daySchedule: TimelineDaySchedule) => {
          const isExpanded = expandedDays.has(daySchedule.dayNumber);
          const places = daySchedule.places || [];
          
          const status = TimelineGenerator.calculateRuntimeStatus(daySchedule as any);
          const health = TimelineGenerator.calculateRuntimeHealth(daySchedule as any);
          const quality = TimelineGenerator.calculateJourneyQuality(daySchedule as any);
          const suggestions = TimelineGenerator.generateSmartSuggestions(daySchedule as any, health, status);

          return (
            <View key={daySchedule.dayNumber} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              {/* Accordion Header */}
              <Pressable 
                onPress={() => toggleDay(daySchedule.dayNumber)}
                className="px-5 py-4 flex-row items-center justify-between bg-gray-50/50"
              >
                <View className="flex-row items-center">
                  <View className="w-8 h-8 rounded-full bg-gray-900 items-center justify-center mr-3">
                    <Typography variant="bodySemibold" className="text-white text-sm">{daySchedule.dayNumber}</Typography>
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Typography variant="bodySemibold" className="text-gray-900 text-lg">Giorno {daySchedule.dayNumber}</Typography>
                      {daySchedule.theme && (
                        <Typography variant="body" className="text-gray-500 ml-2 text-base">— {daySchedule.theme}</Typography>
                      )}
                    </View>
                    {daySchedule.overview && (
                      <View className="flex-row items-center mt-0.5">
                        <Typography variant="captionMedium" className="text-gray-500">
                          {daySchedule.overview.experiencesCount} tappe • {formatDistance(daySchedule.totalWalkDistanceMeters || 0)}
                        </Typography>
                        {daySchedule.mood && (
                          <View className="ml-2 px-2 py-0.5 rounded-full bg-gray-100 flex-row items-center">
                            <Typography variant="caption" className="text-gray-600">
                              {daySchedule.mood === 'relaxed' ? '🟢 Rilassata' : 
                               daySchedule.mood === 'balanced' ? '🟡 Bilanciata' : 
                               daySchedule.mood === 'intense' ? '🟠 Intensa' : 
                               daySchedule.mood === 'photography' ? '🔵 Fotografica' : 
                               daySchedule.mood === 'gastronomic' ? '🟣 Gastronomica' :
                               daySchedule.mood === 'family' ? '🟡 Famiglia' :
                               daySchedule.mood === 'culture' ? '🔵 Culturale' :
                               '🟢 Libera'}
                            </Typography>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
                <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={24} color="#9CA3AF" />
              </Pressable>

              {/* Accordion Content */}
              {isExpanded && (
                <View className="p-5 pt-3 border-t border-gray-100">
                  {/* PROGRESSIVE DISCLOSURE: QUALITY, HEALTH & SUGGESTIONS */}
                  {isAdvancedMode && places.length > 0 && (
                    <View className="mb-4">
                      {/* 1. QUALITY */}
                      <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <View className="w-9 h-9 rounded-full bg-[#4A6741]/10 items-center justify-center mr-3">
                            <Ionicons name="star" size={18} color="#4A6741" />
                          </View>
                          <View>
                            <Typography variant="captionSemibold" className="text-gray-500 uppercase tracking-wider text-[10px]">
                              Journey Quality
                            </Typography>
                            <Typography variant="bodySemibold" className="text-gray-900 text-base">
                              {quality.label} ({quality.score}/100)
                            </Typography>
                          </View>
                        </View>
                        <Typography variant="captionMedium" className="text-[#4A6741] text-xs">
                          {'★'.repeat(quality.stars)}{'☆'.repeat(5 - quality.stars)}
                        </Typography>
                      </View>

                      {/* 2. HEALTH */}
                      <View className="bg-white border border-gray-100 rounded-2xl p-4 mb-3 shadow-sm">
                        <View className="flex-row justify-between items-center mb-2">
                          <View className="flex-row items-center">
                            <Ionicons name="pulse" size={18} color="#2563EB" className="mr-1.5" />
                            <Typography variant="bodySemibold" className="text-gray-900">
                              Daily Health: {health.label}
                            </Typography>
                          </View>
                          <View className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-100">
                            <Typography variant="captionMedium" className="text-blue-700 text-[11px]">
                              {health.status === 'balanced' ? 'Bilanciato' : health.status === 'relaxing' ? 'Rilassato' : 'Intenso'}
                            </Typography>
                          </View>
                        </View>
                        <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-1">
                          <Typography variant="caption" className="text-gray-600">⏱ {health.plannedHours}h stimate</Typography>
                          <Typography variant="caption" className="text-gray-600">🚶 {health.walkingKm} km a piedi</Typography>
                          <Typography variant="caption" className="text-gray-600">🍝 {health.breaksCount} pause</Typography>
                        </View>
                      </View>

                      {/* 3. SUGGESTIONS */}
                      {suggestions && suggestions.length > 0 && (
                        <View className="bg-amber-50/80 border border-amber-200/60 rounded-2xl p-4 mb-2 flex-row items-start">
                          <Ionicons name="bulb-outline" size={20} color="#D97706" className="mr-3 mt-0.5" />
                          <View className="flex-1">
                            <Typography variant="bodySemibold" className="text-amber-900 mb-0.5">
                              {suggestions[0].title}
                            </Typography>
                            <Typography variant="caption" className="text-amber-800 leading-tight">
                              {suggestions[0].description}
                            </Typography>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* TIMELINE LIST */}
                  {places.length === 0 ? (
                    <EmptyState
                      icon="compass-outline"
                      title="Nessuna tappa pianificata."
                      description="Usa il Journey Composer o aggiungi i tuoi luoghi salvati."
                      actionLabel="Pianifica"
                      onAction={() => router.push(`/trip/${tripId}/itinerary?day=${daySchedule.dayNumber}` as any)}
                      className="py-6 px-0"
                    />
                  ) : (
                    <View className="space-y-3">
                      {places.map((place, index) => {
                        const separator = getNarrativeSeparator(place, index);
                        return (
                          <View key={place.id} className="relative">
                            {separator && (
                              <View className="mb-4 mt-2 pl-12">
                                <Typography variant="caption" className="text-gray-400 text-[10px] uppercase tracking-wider">
                                  {index === 0 ? 'Inizia la giornata' : 'Poi'}
                                </Typography>
                                <Typography variant="bodySemibold" className="text-[#4A6741] text-[15px] font-bold mt-0.5">
                                  {separator}
                                </Typography>
                              </View>
                            )}
                            {index < places.length - 1 && (
                              <View className="absolute left-[70px] top-10 bottom-0 w-[2px] bg-gray-200 z-0" />
                            )}
                            <Swipeable
                              renderRightActions={() => (
                                <Pressable
                                  onPress={() => actions.removePlaceFromDay(tripId, daySchedule.dayNumber, place.id)}
                                  className="bg-red-500 justify-center items-center w-20 rounded-2xl mb-5 shadow-sm"
                                >
                                  <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
                                </Pressable>
                              )}
                            >
                              <View className="flex-row items-start bg-white border border-gray-100 rounded-2xl p-4 shadow-sm z-10 mb-5">
                                {/* Orari */}
                                <View className="w-12 items-center pr-3 justify-start pt-1">
                                  <Typography variant="bodySemibold" className="text-gray-900 text-[12px] text-center leading-tight">
                                    {place.calculatedStartTime?.replace(':', ':\n') || '09:\n00'}
                                  </Typography>
                                </View>

                                <View className="w-6 h-6 rounded-full bg-gray-900 items-center justify-center mr-3 shadow-sm mt-0.5">
                                  <Typography variant="bodySemibold" className="text-white text-[10px]">
                                    {index + 1}
                                  </Typography>
                                </View>

                                <Pressable 
                                  onPress={() => router.push(`/trip/${tripId}/places/${place.id}` as any)}
                                  className="flex-1 active:opacity-70"
                                >
                                  <Typography variant="bodySemibold" className="text-gray-900 text-base leading-tight flex-1">
                                    {place.category === 'free_time' ? 'Tempo Libero' : place.name}
                                  </Typography>
                                  <Typography variant="caption" className="text-gray-500 mt-1 capitalize">
                                    {place.category === 'free_time' ? 'Relax' : place.category} • {place.durationMinutes || 60} min
                                  </Typography>

                                  {isAdvancedMode && place.estimatedWalkMinutes !== undefined && place.estimatedWalkMinutes > 0 && (
                                    <View className="flex-row items-center mt-2 bg-gray-50 self-start px-2 py-1 rounded-md border border-gray-100">
                                      <Ionicons name="walk" size={12} color="#6B7280" />
                                      <Typography variant="captionMedium" className="text-gray-600 ml-1 text-[10px]">
                                        {place.estimatedWalkMinutes} min a piedi
                                      </Typography>
                                    </View>
                                  )}
                                </Pressable>
                              </View>
                            </Swipeable>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {/* REPORT in ADVANCED MODE */}
                  {isAdvancedMode && daySchedule.optimizationReport && (
                    <View className="mt-5 bg-[#FAF9F6] border border-gray-200/80 rounded-2xl p-4">
                      <View className="flex-row items-center mb-3">
                        <Ionicons name="analytics-outline" size={16} color="#4A6741" className="mr-2" />
                        <Typography variant="bodySemibold" className="text-gray-900 text-sm">
                          Report Ottimizzazione
                        </Typography>
                      </View>
                      <View className="space-y-2">
                        {OptimizationReportFormatter.formatReport(daySchedule.optimizationReport).map((item) => (
                          <View key={item.id} className="flex-row items-start bg-white p-2.5 rounded-xl border border-gray-100 shadow-2xs">
                            <View className="w-6 h-6 rounded-full bg-green-50 items-center justify-center mr-2.5 mt-0.5">
                              <Ionicons name={item.icon as any} size={14} color="#10B981" />
                            </View>
                            <View className="flex-1">
                              <Typography variant="bodySemibold" className="text-gray-800 text-xs">{item.title}</Typography>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
};
