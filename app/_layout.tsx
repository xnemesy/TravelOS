import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import '../src/core/global.css';
import { ToastProvider } from '../src/shared/components/Toast';

// Ignora i warning in console causati da DraggableFlatList che legge/scrive `value` in fase di render
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="trip" />
      </Stack>
      <ToastProvider />
    </GestureHandlerRootView>
  );
}
