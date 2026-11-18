import PraktikanScreen from '../features/praktikan';
import { useAuth } from '../context/auth-context';

export default function PraktikanPage() {
  const { user } = useAuth();
  return <PraktikanScreen user={user} />;
}
