import { Redirect } from 'expo-router';

export default function Index() {
  // Per ora reindirizziamo semplicemente alle tabs
  return <Redirect href="/(tabs)" />;
}
