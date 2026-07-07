import React from 'react';
import { View, Pressable, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useGlobalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../src/shared/components/Typography';
import { EmptyState } from '../../../src/shared/components/EmptyState';
import { mockBudapestEvents } from '../../../src/features/trips/mock/budapest.mock';

export default function BudgetScreen() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ id: string | string[] }>();
  const globalParams = useGlobalSearchParams<{ id: string | string[] }>();
  const idParam = localParams.id || globalParams.id;
  const tripId = (Array.isArray(idParam) ? idParam[0] : idParam) || 'trip-budapest-2026';

  const isBudapest = tripId === 'trip-budapest-2026';
  
  // Calculate expenses from mock data
  const eventsWithCost = (isBudapest ? mockBudapestEvents : []).filter(e => e.cost !== undefined);
  const totalSpent = eventsWithCost.reduce((sum, e) => sum + (e.cost || 0), 0);
  const totalBudget = 1000; // Simulated total budget

  return (
    <SafeAreaView className="flex-1 bg-[#FAF9F6]">
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View className="px-5 py-2 flex-row items-center border-b border-gray-100 pb-4">
        <Pressable onPress={() => router.back()} className="mr-4 flex-row items-center">
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
          <Typography variant="bodySemibold" className="text-gray-900 ml-1">Dettaglio</Typography>
        </Pressable>
      </View>

      <View className="px-5 pt-4 pb-6 border-b border-gray-100 bg-white">
        <Typography variant="h2" className="text-gray-900">Budget</Typography>
        <Typography variant="body" className="text-gray-500 mt-1">Traccia le spese del tuo viaggio</Typography>
      </View>

      {eventsWithCost.length === 0 ? (
        <EmptyState
          icon="pie-chart-outline"
          title="Nessuna spesa"
          description="Aggiungi le tue spese o imposta un limite per tenere traccia del budget totale."
          actionLabel="Aggiungi spesa"
          onAction={() => console.log('Add expense')}
        />
      ) : (
        <ScrollView className="flex-1 px-5 pt-6">
          {/* Card Riepilogo */}
          <View className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm mb-6">
            <Typography variant="caption" className="text-gray-400 uppercase tracking-wider mb-1">
              Spese Totali
            </Typography>
            <Typography variant="h1" className="text-gray-900 font-bold text-3xl mb-4">
              €{totalSpent.toFixed(2)}
            </Typography>
            
            {/* Progress bar del budget */}
            <View className="w-full h-2 bg-gray-100 rounded-full overflow-hidden mb-2">
              <View 
                className="bg-green-600 h-full rounded-full" 
                style={{ width: `${(totalSpent / totalBudget) * 100}%` }}
              />
            </View>
            <View className="flex-row justify-between">
              <Typography variant="captionMedium" className="text-gray-400">
                Limite budget: €{totalBudget}
              </Typography>
              <Typography variant="captionMedium" className="text-gray-500">
                {((totalSpent / totalBudget) * 100).toFixed(0)}% utilizzato
              </Typography>
            </View>
          </View>

          {/* Lista delle Spese Singole */}
          <Typography variant="h3" className="mb-4">Transazioni Recenti</Typography>
          <View className="bg-white rounded-2xl overflow-hidden border border-gray-100">
            {eventsWithCost.map((item, index) => {
              const isLast = index === eventsWithCost.length - 1;
              return (
                <View 
                  key={item.id} 
                  className={`flex-row justify-between items-center p-4 bg-white ${!isLast ? 'border-b border-gray-100' : ''}`}
                >
                  <View className="flex-1 pr-2">
                    <Typography variant="bodySemibold" className="text-gray-900">
                      {item.title}
                    </Typography>
                    <Typography variant="caption" className="text-gray-400 capitalize mt-0.5">
                      {item.type}
                    </Typography>
                  </View>
                  <Typography variant="bodySemibold" className="text-gray-900">
                    - €{item.cost?.toFixed(2)}
                  </Typography>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
