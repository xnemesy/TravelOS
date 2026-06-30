import React from 'react';
import { View, SafeAreaView, Pressable, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../../src/shared/components/Typography';
import { EmptyState } from '../../../src/shared/components/EmptyState';

export default function TodayScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      
      {/* Header Comune */}
      <View className="px-5 py-2 flex-row items-center border-b border-border-light pb-4">
        <Pressable onPress={() => router.back()} className="mr-4 flex-row items-center">
          <Ionicons name="chevron-back" size={24} color="#007AFF" />
          <Typography variant="bodySemibold" color="accent" className="ml-1">Dashboard</Typography>
        </Pressable>
      </View>

      <View className="px-5 pt-4 pb-6 border-b border-border-light">
        <Typography variant="h2">Today</Typography>
        <Typography variant="body" color="secondary" className="mt-1">Il tuo viaggio giorno per giorno</Typography>
      </View>

      <EmptyState
        icon="calendar-outline"
        title="Niente in programma"
        description="Il tuo viaggio non è ancora iniziato o non ci sono eventi pianificati per oggi."
        actionLabel="Aggiungi evento oggi"
        onAction={() => console.log('Add event')}
      />
    </SafeAreaView>
  );
}
