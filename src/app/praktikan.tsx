import { useAuth } from '../context/auth-context';
import PraktikanScreen from '../features/praktikan';

export default function PraktikanPage() {
  const { user } = useAuth();
  return <PraktikanScreen user={user} />;
}
