import React from 'react';
import { KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { TripSetupWizard } from '../../src/features/trips/wizard/TripSetupWizard';

export default function CreateTripModalScreen() {
  const { editTripId } = useLocalSearchParams<{ editTripId?: string }>();

  return (
    <SafeAreaView className="flex-1 bg-white">
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <TripSetupWizard editTripId={editTripId} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
