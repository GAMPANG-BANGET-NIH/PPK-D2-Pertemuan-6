/**
 * Rute `/praktikan` — menampilkan status kehadiran ("Hadir" / "Terlambat X menit" / "Izin")
 * dan pintasan navigasi `/tagihan` pada Sprint 4 (Moses).
 */
import { useAuth } from '../context/auth-context';
import PraktikanScreen from '../features/praktikan';

export default function PraktikanPage() {
  const { user } = useAuth();
  return <PraktikanScreen user={user} />;
}
