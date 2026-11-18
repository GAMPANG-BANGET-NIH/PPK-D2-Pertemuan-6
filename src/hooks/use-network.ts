import { useNetInfo } from '@react-native-community/netinfo';

export function useNetwork(): { isOnline: boolean } {
  const { isConnected, isInternetReachable } = useNetInfo();
  // Unknown connection is offline; null reachability is common on web.
  return { isOnline: isConnected === true && isInternetReachable !== false };
}
