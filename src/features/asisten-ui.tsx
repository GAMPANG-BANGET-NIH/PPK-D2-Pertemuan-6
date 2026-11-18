/**
 * Komponen UI bersama untuk layar Asprak (Fitur B — Mischa).
 * Hanya dipakai oleh `asisten*.tsx`. Style lokal; tema global tidak diubah.
 */
import { type Href, router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { UserHeader } from '@/components/user-header';
import type { SessionStatus } from '@/types';

/* ------------------------------------------------------------------ */
/* Konstanta dan helper tampilan                                       */
/* ------------------------------------------------------------------ */

export const STATUS_LABELS: Record<SessionStatus, string> = {
  belum_dibuka: 'Belum dibuka',
  dibuka: 'Dibuka',
  ditutup: 'Ditutup',
};

// Simbol tambahan agar status tidak dibedakan melalui warna saja.
export const STATUS_SYMBOLS: Record<SessionStatus, string> = {
  belum_dibuka: '○',
  dibuka: '●',
  ditutup: '■',
};

export const DAY_NAMES = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
] as const;

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek - 1] ?? '-';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Waktu lokal perangkat: HH.MM */
export function formatClock(date: Date | null): string {
  return date ? `${pad(date.getHours())}.${pad(date.getMinutes())}` : '-';
}

/** "08:00" → "08.00" (konsisten dengan Sprint 1). */
export function formatRange(start: string, end: string): string {
  return `${start.replace(':', '.')}–${end.replace(':', '.')}`;
}

/** Navigasi ke rute string (rute lintas fitur belum tentu ada di tipe saat paralel). */
export function navigate(path: string) {
  router.push(path as Href);
}

export function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/* ------------------------------------------------------------------ */
/* Kerangka layar                                                      */
/* ------------------------------------------------------------------ */

export function Screen({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <UserHeader />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled">
        <View style={styles.titleBlock}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

/* ------------------------------------------------------------------ */
/* Tombol, chip, badge                                                 */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: ButtonVariant;
  accessibilityLabel?: string;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={[
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'danger' && styles.buttonDanger,
        inactive && styles.buttonDisabled,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? '#1B1F24' : '#FFFFFF'} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'secondary' && styles.buttonTextSecondary,
            inactive && styles.buttonTextDisabled,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {selected ? '✓ ' : ''}
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function StatusBadge({ status }: { status: SessionStatus }) {
  return (
    <View style={[styles.badge, badgeStyles[status]]}>
      <Text style={styles.badgeText}>
        {STATUS_SYMBOLS[status]} {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

export function Tag({ text }: { text: string }) {
  return (
    <View style={[styles.badge, styles.tag]}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Form                                                                */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  hint,
  keyboardType,
  editable = true,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  hint?: string;
  keyboardType?: 'default' | 'numbers-and-punctuation';
  editable?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType={keyboardType}
        editable={editable}
        maxLength={maxLength}
        style={[styles.input, !editable && styles.inputDisabled]}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <Text accessibilityRole="alert" style={styles.formError}>
      ⚠ {message}
    </Text>
  );
}

export function Notice({ message }: { message: string | null }) {
  if (!message) {
    return null;
  }
  return (
    <Text accessibilityLiveRegion="polite" style={styles.notice}>
      {message}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/* Kondisi loading / error / kosong                                    */
/* ------------------------------------------------------------------ */

export function LoadingBox({ text = 'Memuat data…' }: { text?: string }) {
  return (
    <View style={styles.stateBox} accessibilityLiveRegion="polite">
      <ActivityIndicator />
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={[styles.stateBox, styles.errorBox]} accessibilityRole="alert">
      <Text style={styles.errorTitle}>Terjadi kesalahan</Text>
      <Text style={styles.stateText}>{message}</Text>
      {onRetry ? <Button label="Coba lagi" variant="secondary" onPress={onRetry} /> : null}
    </View>
  );
}

export function EmptyBox({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.stateText}>{text}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Modal konfirmasi                                                    */
/* ------------------------------------------------------------------ */

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Batal',
  busy,
  danger,
  error,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  danger?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) {
          onCancel();
        }
      }}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={styles.modalTitle}>
            {title}
          </Text>
          <Text style={styles.modalMessage}>{message}</Text>
          <FormError message={error ?? null} />
          <View style={styles.modalActions}>
            <View style={styles.modalAction}>
              <Button
                label={cancelLabel}
                variant="secondary"
                disabled={busy}
                onPress={onCancel}
              />
            </View>
            <View style={styles.modalAction}>
              <Button
                label={confirmLabel}
                variant={danger ? 'danger' : 'primary'}
                loading={busy}
                onPress={onConfirm}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/* Style                                                               */
/* ------------------------------------------------------------------ */

const badgeStyles = StyleSheet.create({
  belum_dibuka: { backgroundColor: '#F1F3F5', borderColor: '#5C6670' },
  dibuka: { backgroundColor: '#E6F4EA', borderColor: '#1E6B3A' },
  ditutup: { backgroundColor: '#FDECEA', borderColor: '#9B2C2C' },
});

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FA' },
  container: { padding: 16, paddingBottom: 32, gap: 16 },
  titleBlock: { gap: 4 },
  title: { fontSize: 24, fontWeight: '700', color: '#1B1F24' },
  subtitle: { fontSize: 14, color: '#4A5159' },
  section: { gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: '#1B1F24' },
  card: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DAE0',
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#1B1F24' },
  line: { fontSize: 15, color: '#2B3037' },
  meta: { fontSize: 14, color: '#4A5159' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  buttonPrimary: { backgroundColor: '#1F4FD8' },
  buttonSecondary: { backgroundColor: '#FFFFFF', borderColor: '#5C6670' },
  buttonDanger: { backgroundColor: '#B42318' },
  buttonDisabled: { backgroundColor: '#E3E6EA', borderColor: '#E3E6EA' },
  buttonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  buttonTextSecondary: { color: '#1B1F24' },
  buttonTextDisabled: { color: '#4A5159' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#B8BFC7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  chipSelected: { borderWidth: 2, borderColor: '#1F4FD8', backgroundColor: '#E8EEFF' },
  chipText: { fontSize: 15, fontWeight: '600', color: '#1B1F24' },
  chipTextSelected: { color: '#12308C' },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  badgeText: { fontSize: 13, fontWeight: '600', color: '#1B1F24' },
  tag: { backgroundColor: '#F1F3F5', borderColor: '#5C6670' },
  field: { gap: 4 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#1B1F24' },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#B8BFC7',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#1B1F24',
    backgroundColor: '#FFFFFF',
  },
  inputDisabled: { backgroundColor: '#E3E6EA' },
  hint: { fontSize: 13, color: '#4A5159' },
  formError: {
    fontSize: 14,
    color: '#8A1C14',
    backgroundColor: '#FDECEA',
    padding: 10,
    borderRadius: 8,
  },
  notice: {
    fontSize: 14,
    color: '#12308C',
    backgroundColor: '#E8EEFF',
    padding: 10,
    borderRadius: 8,
  },
  stateBox: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D5DAE0',
    alignItems: 'center',
    gap: 8,
  },
  errorBox: { borderColor: '#9B2C2C', backgroundColor: '#FDECEA' },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#8A1C14' },
  stateText: { fontSize: 14, color: '#2B3037', textAlign: 'center' },
  empty: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#B8BFC7',
    backgroundColor: '#FFFFFF',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1B1F24' },
  modalMessage: { fontSize: 15, color: '#2B3037' },
  modalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalAction: { flexGrow: 1, flexBasis: 130 },
});
