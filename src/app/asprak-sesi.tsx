import { useAuth } from '../context/auth-context';
import AsprakSesiScreen from '../features/asprak-sesi';

export default function AsprakSesiPage() {
  const { user } = useAuth();
  return <AsprakSesiScreen user={user} />;
}
