export function validateLogin(email: string, password: string): string | null {
  if (!email.trim() || !password.trim()) return 'Email dan password wajib diisi.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Format email tidak valid.';
  return null;
}
