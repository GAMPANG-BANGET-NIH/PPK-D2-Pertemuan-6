import { StyleSheet, Text, View } from 'react-native';

import { useNetwork } from '@/hooks/use-network';

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  if (isOnline) return null;
  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <Text style={styles.text}>Anda sedang offline. Perubahan data tidak dapat dikirim.</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  banner: { padding: 16, backgroundColor: '#fff3cd' },
  text: { color: '#533f03' },
});
