import { Redirect } from 'expo-router';
import { useAuth } from '@/context/auth-context';

export default function HomePage() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return <Redirect href={!user ? '/login' : user.role === 'asprak' ? '/asisten' : '/praktikan'} />;
}
