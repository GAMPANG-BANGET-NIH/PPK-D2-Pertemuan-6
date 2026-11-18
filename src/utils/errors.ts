const messages: Record<string, string> = {
  'auth/invalid-credential': 'Email atau password salah.',
  'auth/user-not-found': 'Email atau password salah.',
  'auth/wrong-password': 'Email atau password salah.',
  'auth/invalid-email': 'Format email tidak valid.',
  'auth/user-disabled': 'Akun dinonaktifkan. Hubungi pengelola.',
  'auth/too-many-requests': 'Terlalu banyak percobaan. Coba lagi nanti.',
  'auth/network-request-failed': 'Koneksi bermasalah. Periksa jaringan Anda.',
  'permission-denied': 'Anda tidak memiliki izin untuk tindakan ini.',
  unavailable: 'Koneksi bermasalah. Periksa jaringan Anda.',
};

export function getErrorMessage(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  return typeof code === 'string' && messages[code]
    ? messages[code]
    : 'Terjadi kesalahan. Silakan coba lagi.';
}
