import { Stack } from 'expo-router';
import '../../src/core/global.css';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="trip/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}
