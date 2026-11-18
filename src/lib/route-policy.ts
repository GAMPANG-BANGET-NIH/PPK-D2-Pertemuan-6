export function redirectFor(role: 'asprak' | 'praktikan' | null, path: string): '/login' | '/asisten' | '/praktikan' | null {
  if (!role) return path === '/login' ? null : '/login';
  const allowed = role === 'asprak'
    ? ['/asisten', '/kelola', '/rekap', '/pindah-kelas', '/asisten-izin']
    : ['/praktikan', '/izin'];
  return allowed.includes(path) ? null : role === 'asprak' ? '/asisten' : '/praktikan';
}
