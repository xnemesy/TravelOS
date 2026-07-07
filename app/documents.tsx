import React from 'react';
import { View, ScrollView, StatusBar, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../src/shared/components/Typography';
import { Button } from '../src/shared/components/Button';

export default function DocumentsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-gray-100">
        <Pressable onPress={() => router.back()} className="flex-row items-center -ml-2 p-2">
          <Ionicons name="chevron-back" size={24} color="#1C1C1E" />
          <Typography variant="bodySemibold" className="text-gray-900 ml-1">Profilo</Typography>
        </Pressable>
        <Typography variant="h3" className="text-gray-900">Documenti & Passaporti</Typography>
        <View className="w-16" />
      </View>

      <ScrollView className="flex-1 px-5 pt-6" showsVerticalScrollIndicator={false}>
        <View className="items-center justify-center py-20 px-6 bg-card rounded-3xl border border-border-light shadow-sm my-6">
          <View className="w-16 h-16 rounded-full bg-green-50 items-center justify-center mb-4">
            <Ionicons name="shield-checkmark-outline" size={32} color="#10B981" />
          </View>
          <Typography variant="h2" className="text-gray-900 text-center mb-2">
            Il tuo Travel Vault è pronto
          </Typography>
          <Typography variant="body" color="secondary" align="center" className="mb-8 max-w-xs leading-relaxed">
            Conserva qui in modo cifrato e sicuro (Zero-Knowledge) copie di passaporti, visti, biglietti aerei e prenotazioni d'albergo.
          </Typography>
          <Button
            label="Aggiungi Documento"
            onPress={() => {}}
            variant="solid"
            size="md"
            icon="add"
          />
        </View>

        <View className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm mb-12">
          <View className="flex-row items-start">
            <Ionicons name="lock-closed" size={20} color="#10B981" className="mr-3 mt-0.5" />
            <View className="flex-1">
              <Typography variant="bodySemibold" className="text-gray-900 mb-1">
                Sicurezza Zero-Knowledge
              </Typography>
              <Typography variant="caption" color="secondary" className="leading-relaxed">
                I tuoi documenti sensibili non lasceranno mai questo dispositivo senza la tua esplicita autorizzazione e cifratura di livello militare.
              </Typography>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
