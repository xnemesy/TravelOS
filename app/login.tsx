import React, { useState } from 'react';
import { View, SafeAreaView, KeyboardAvoidingView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { AuthService } from '../src/services/auth/auth.service';
import { Typography } from '../src/shared/components/Typography';
import { Button } from '../src/shared/components/Button';
import { Card } from '../src/shared/components/Card';
import { TextInput } from 'react-native';

// NOTA: Questa schermata è attualmente disconnessa dalla navigazione principale
// ed è pronta per essere testata in isolamento o agganciata successivamente.

export default function LoginScreen() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Inserisci email e password');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      // In un'app reale con gli account già creati, questo farebbe il login.
      // Se vogliamo permettere la creazione dinamica, potremmo fare signIn o signUp a seconda se l'utente esiste.
      await AuthService.signIn(email, password);
      
      // Una volta loggato, l'utente potrebbe essere rindirizzato da _layout
      // o possiamo forzare un router.replace('/') qui per sicurezza.
      router.replace('/');
    } catch (e: any) {
      setError(e.message || 'Errore durante il login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <StatusBar barStyle="dark-content" />
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 justify-center px-6"
      >
        <Animated.View entering={FadeIn.duration(800)} className="mb-12">
          <Typography variant="overline" color="secondary" className="mb-2">Travel OS</Typography>
          <Typography variant="h1" className="mb-4 text-4xl">Il tuo passaporto per il mondo.</Typography>
          <Typography variant="body" color="secondary">Accedi per ritrovare i tuoi viaggi, o iscriviti in un attimo.</Typography>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(600).springify()}>
          <Card variant="flat" padding="none" className="bg-transparent mb-6 border-0">
            {error && (
              <View className="mb-4 bg-red-50 p-3 rounded-lg border border-red-100">
                <Typography variant="captionMedium" color="primary">{error}</Typography>
              </View>
            )}

            <View className="bg-white rounded-[20px] mb-4 overflow-hidden shadow-sm">
              <View className="px-4 py-3 border-b border-gray-100">
                <Typography variant="caption" color="secondary" className="mb-1">Email</Typography>
                <TextInput 
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  className="font-inter text-base text-text-primary py-1"
                  placeholder="La tua email"
                  placeholderTextColor="#C6C6C8"
                />
              </View>
              <View className="px-4 py-3">
                <Typography variant="caption" color="secondary" className="mb-1">Password</Typography>
                <TextInput 
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  className="font-inter text-base text-text-primary py-1"
                  placeholder="La tua password"
                  placeholderTextColor="#C6C6C8"
                />
              </View>
            </View>
          </Card>

          <Button 
            label={isLoading ? "Accesso in corso..." : "Continua"} 
            fullWidth 
            disabled={isLoading}
            onPress={handleLogin}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
