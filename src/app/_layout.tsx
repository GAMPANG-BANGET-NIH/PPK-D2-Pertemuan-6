import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OfflineBanner } from '@/components/offline-banner';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { useNotifications } from '@/hooks/use-notifications';

void SplashScreen.preventAutoHideAsync();

function AuthenticatedNavigator() {
  const { user, loading } = useAuth();
  useNotifications(user);

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Memuat akun" /></View>;
  }
  return (
    <>
      <AnimatedSplashOverlay />
      <OfflineBanner />
      <Stack screenOptions={{ headerBackTitle: 'Beranda', headerTitleStyle: { fontWeight: '600' } }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Protected guard={!user}>
          <Stack.Screen name="login" options={{ title: 'Login' }} />
        </Stack.Protected>
        <Stack.Protected guard={user?.role === 'asprak'}>
          <Stack.Screen name="asisten" options={{ title: 'Asprak' }} />
          <Stack.Screen name="asisten-izin" options={{ title: 'Review izin' }} />
          <Stack.Screen name="kelola" />
          <Stack.Screen name="rekap" />
          <Stack.Screen name="pindah-kelas" />
          <Stack.Screen name="laboratorium" options={{ title: 'Laboratorium' }} />
        </Stack.Protected>
        <Stack.Protected guard={user?.role === 'praktikan'}>
          <Stack.Screen name="praktikan" options={{ title: 'Praktikan' }} />
          <Stack.Screen name="izin" />
          <Stack.Screen name="presensi-lokasi" options={{ title: 'Presensi Lokasi' }} />
          <Stack.Screen name="maps" options={{ title: 'Peta Lab' }} />
        </Stack.Protected>
        <Stack.Protected guard={false}>
          <Stack.Screen name="explore" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider><AuthenticatedNavigator /></AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
