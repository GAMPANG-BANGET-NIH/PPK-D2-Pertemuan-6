/**
 * Kanvas Maps Fallback Web — Sprint 3, SRS-04 (Moses).
 *
 * `react-native-maps` adalah modul native Android/iOS. Pada target Web, file
 * platform `.web.tsx` ini menjaga bundel Expo Web tetap bersih tanpa crash
 * sambil tetap menampilkan daftar marker lab interaktif, koordinat, radius,
 * dan posisi pengguna.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { calculateHaversineDistanceMeters } from '../services/attendance-verification';
import type { Laboratorium } from '../services/laboratorium';
import {
  formatCoordinates,
  formatDistanceMeters,
  type LocationReading,
} from '../services/lokasi';

export type MapFocusTarget = {
  latitude: number;
  longitude: number;
  nonce: number;
};

export type MapsCanvasProps = {
  labs: Laboratorium[];
  selectedLabId: string | null;
  userLocation: LocationReading | null;
  onSelectLab: (labId: string) => void;
  focusTarget: MapFocusTarget | null;
};

export function MapsCanvas({
  labs,
  selectedLabId,
  userLocation,
  onSelectLab,
}: MapsCanvasProps) {
  return (
    <View style={styles.webCard}>
      <Text style={styles.webTitle}>Mode Web — Ringkasan Marker Laboratorium</Text>
      <Text style={styles.webSubtitle}>
        Peta native interaktif (Google/Apple Maps + lingkaran radius) berjalan penuh pada build
        Android/iOS. Di browser, pilih marker laboratorium di bawah untuk melihat detail dan
        aktivitas realtime.
      </Text>

      <View style={styles.userBox}>
        <Text style={styles.userLabel}>Posisi Perangkat:</Text>
        <Text style={styles.userCoords}>
          {userLocation
            ? `${formatCoordinates(userLocation.latitude, userLocation.longitude)} (±${Math.round(userLocation.accuracy)} m)`
            : 'Belum tersedia'}
        </Text>
      </View>

      {labs.length === 0 ? (
        <Text style={styles.emptyText}>Belum ada marker laboratorium yang tersedia.</Text>
      ) : (
        <View style={styles.pinList}>
          {labs.map((lab) => {
            const selected = lab.id === selectedLabId;
            const distance = userLocation
              ? calculateHaversineDistanceMeters(
                  userLocation.latitude,
                  userLocation.longitude,
                  lab.latitude,
                  lab.longitude,
                )
              : null;

            return (
              <Pressable
                key={lab.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.pinItem, selected && styles.pinItemSelected]}
                onPress={() => onSelectLab(lab.id)}
              >
                <Text style={styles.pinName}>
                  {selected ? '◉ ' : '○ '}
                  {lab.name} ({lab.active ? 'Aktif' : 'Nonaktif'})
                </Text>
                <Text style={styles.pinMeta}>
                  Koordinat: {formatCoordinates(lab.latitude, lab.longitude)} · Radius:{' '}
                  {lab.radiusMeters} m
                </Text>
                {distance !== null && (
                  <Text style={styles.pinMeta}>
                    Jarak dari Anda: {formatDistanceMeters(distance)}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  webCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    padding: 14,
    gap: 10,
  },
  webTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  webSubtitle: {
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 18,
  },
  userBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    gap: 2,
  },
  userLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  userCoords: {
    fontSize: 12,
    color: '#0F172A',
  },
  emptyText: {
    fontSize: 13,
    color: '#475569',
  },
  pinList: {
    gap: 8,
  },
  pinItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 10,
    gap: 3,
  },
  pinItemSelected: {
    borderColor: '#2563EB',
    borderWidth: 2,
    backgroundColor: '#F8FAFF',
  },
  pinName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  pinMeta: {
    fontSize: 12,
    color: '#475569',
  },
});
