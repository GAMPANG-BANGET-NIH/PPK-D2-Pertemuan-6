/** Seed: GOOGLE_APPLICATION_CREDENTIALS points outside repo to service account.
 * SEED_DATA_FILE points outside repo to approved JSON with accounts/classes/schedules/sessions.
 * accounts contain email/name/role/classId/password; passwords never logged or stored in Firestore.
 * FIREBASE_PROJECT_ID must explicitly match service account target. Run node scripts/seed.mjs.
 * Missing date/dayOfWeek/room values must come from owner, never invented.
 */
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

export async function seedMissing(data, store) {
  for (const account of data.accounts) {
    const uid = await store.ensureAccount(account);
    await store.createIfMissing(`users/${uid}`, {
      name: account.name, email: account.email, role: account.role, classId: account.classId,
    });
  }
  for (const collection of ['classes', 'schedules', 'sessions']) {
    for (const record of data[collection]) {
      const { id, ...fields } = record;
      await store.createIfMissing(`${collection}/${id}`, fields);
    }
  }
}

async function main() {
  if (!process.env.SEED_DATA_FILE || !process.env.FIREBASE_PROJECT_ID || !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    throw new Error('Konfigurasi seed privat belum lengkap.');
  }
  const data = JSON.parse(await readFile(process.env.SEED_DATA_FILE, 'utf8'));
  for (const key of ['accounts', 'classes', 'schedules', 'sessions']) {
    if (!Array.isArray(data[key])) throw new Error('Struktur seed tidak valid.');
  }
  // Validate whole payload before first external write.
  for (const account of data.accounts) {
    if (typeof account.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)
      || typeof account.name !== 'string' || !account.name.trim()
      || !['asprak', 'praktikan'].includes(account.role)
      || (account.role === 'asprak' ? account.classId !== null : typeof account.classId !== 'string')
      || typeof account.password !== 'string' || account.password.length < 12) throw new Error('Akun seed tidak valid.');
  }
  for (const key of ['classes', 'schedules', 'sessions']) {
    for (const record of data[key]) {
      if (typeof record.id !== 'string' || !record.id || record.id.includes('/')) throw new Error('ID seed tidak valid.');
    }
  }
  const { initializeApp, applicationDefault } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const credential = JSON.parse(await readFile(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8'));
  if (credential.project_id !== process.env.FIREBASE_PROJECT_ID) throw new Error('Project seed tidak cocok.');
  const app = initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
  const auth = getAuth(app);
  const db = getFirestore(app);
  await seedMissing(data, {
    async ensureAccount(account) {
      try { return (await auth.getUserByEmail(account.email)).uid; }
      catch (error) {
        if (error.code !== 'auth/user-not-found') throw error;
        return (await auth.createUser({ email: account.email, displayName: account.name, password: account.password })).uid;
      }
    },
    async createIfMissing(path, fields) {
      const ref = db.doc(path);
      await db.runTransaction(async (transaction) => {
        if (!(await transaction.get(ref)).exists) transaction.create(ref, { ...fields, createdAt: FieldValue.serverTimestamp() });
      });
    },
  });
  console.log('Seed selesai; data yang sudah ada dipertahankan.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Seed gagal. Periksa konfigurasi privat, izin, dan data seed.'); process.exitCode = 1; });
}
