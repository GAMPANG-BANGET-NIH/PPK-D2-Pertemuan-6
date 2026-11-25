/**
 * Kanvas Maps Native (Android/iOS) — Sprint 3, SRS-04 (Moses).
 *
 * Menampilkan `<MapView>`, `<Marker>` untuk setiap laboratorium & posisi
 * pengguna, serta `<Circle>` untuk visualisasi radius lab (visualisasi saja,
 * bukan mekanisme otorisasi presensi). Dilengkapi Error Boundary agar gagal
 * muat peta menampilkan pesan status yang jelas.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';

import type { Laboratorium } from '../services/laboratorium';
import { isValidCoordinatePair, type LocationReading } from '../services/lokasi';

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

const FALLBACK_REGION: Region = {
  latitude: -6.2,
  longitude: 106.816666,
  latitudeDelta: 0.015,
  longitudeDelta: 0.015,
};

type BoundaryState = { hasError: boolean };

class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  BoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallbackBox}>
          <Text style={styles.fallbackTitle}>⚠ Peta Gagal Dimuat</Text>
          <Text style={styles.fallbackText}>
            Komponen peta tidak dapat dirender pada perangkat/build ini. Anda tetap dapat memilih
            laboratorium dari daftar di bawah untuk melihat detail dan aktivitas realtime.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export function MapsCanvas({
  labs,
  selectedLabId,
  userLocation,
  onSelectLab,
  focusTarget,
}: MapsCanvasProps) {
  const mapRef = useRef<MapView | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const validLabs = useMemo(
    () => labs.filter((lab) => isValidCoordinatePair(lab.latitude, lab.longitude)),
    [labs],
  );

  const initialRegion = useMemo<Region>(() => {
    const selected = validLabs.find((lab) => lab.id === selectedLabId);
    if (selected) {
      return {
        latitude: selected.latitude,
        longitude: selected.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
    }
    const firstActive = validLabs.find((lab) => lab.active) ?? validLabs[0];
    if (firstActive) {
      return {
        latitude: firstActive.latitude,
        longitude: firstActive.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
    }
    if (userLocation && isValidCoordinatePair(userLocation.latitude, userLocation.longitude)) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
    }
    return FALLBACK_REGION;
  }, [validLabs, selectedLabId, userLocation]);

  useEffect(() => {
    if (!mapReady || !focusTarget || !mapRef.current) {
      return;
    }
    if (!isValidCoordinatePair(focusTarget.latitude, focusTarget.longitude)) {
      return;
    }
    mapRef.current.animateToRegion(
      {
        latitude: focusTarget.latitude,
        longitude: focusTarget.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      },
      450,
    );
  }, [mapReady, focusTarget]);

  return (
    <MapErrorBoundary>
      <View style={styles.mapFrame}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          showsUserLocation={userLocation !== null}
          showsMyLocationButton={false}
          showsCompass
          onMapReady={() => setMapReady(true)}
        >
          {userLocation &&
            isValidCoordinatePair(userLocation.latitude, userLocation.longitude) && (
              <Marker
                identifier="user-current-location"
                coordinate={{
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                }}
                title="Posisi Anda"
                description={`Akurasi GPS ±${Math.round(userLocation.accuracy)} m`}
                pinColor="#2563EB"
              />
            )}

          {validLabs.map((lab) => {
            const isSelected = lab.id === selectedLabId;
            const pinColor = isSelected
              ? '#1D4ED8'
              : lab.active
                ? '#16A34A'
                : '#64748B';
            const strokeColor = !lab.active
              ? 'rgba(100, 116, 139, 0.7)'
              : isSelected
                ? 'rgba(29, 78, 216, 0.95)'
                : 'rgba(22, 163, 74, 0.75)';
            const fillColor = !lab.active
              ? 'rgba(100, 116, 139, 0.12)'
              : isSelected
                ? 'rgba(37, 99, 235, 0.22)'
                : 'rgba(22, 163, 74, 0.12)';

            return (
              <React.Fragment key={lab.id}>
                <Marker
                  identifier={lab.id}
                  coordinate={{
                    latitude: lab.latitude,
                    longitude: lab.longitude,
                  }}
                  title={lab.name}
                  description={`${lab.active ? 'Aktif' : 'Nonaktif'} · Radius ${lab.radiusMeters} m`}
                  pinColor={pinColor}
                  onPress={() => onSelectLab(lab.id)}
                />
                {lab.radiusMeters > 0 && (
                  <Circle
                    center={{
                      latitude: lab.latitude,
                      longitude: lab.longitude,
                    }}
                    radius={lab.radiusMeters}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    strokeColor={strokeColor}
                    fillColor={fillColor}
                  />
                )}
              </React.Fragment>
            );
          })}
        </MapView>

        {!mapReady && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color="#2563EB" />
            <Text style={styles.loadingText}>Memuat peta interaktif...</Text>
          </View>
        )}
      </View>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  mapFrame: {
    height: 300,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#E2E8F0',
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  fallbackBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    padding: 16,
    gap: 6,
  },
  fallbackTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#991B1B',
  },
  fallbackText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
  },
});
