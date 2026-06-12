import admin from 'firebase-admin';

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';

let initialized = false;

/**
 * Loads the service account credentials from either:
 * 1. FIREBASE_SERVICE_ACCOUNT env var (JSON string — for Vercel / cloud deployments)
 * 2. FIREBASE_SERVICE_ACCOUNT_PATH file path (for local dev)
 */
function loadServiceAccount(): admin.ServiceAccount {
  // Option 1: JSON string in env var (Vercel, cloud deployments)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      return JSON.parse(serviceAccountJson) as admin.ServiceAccount;
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT env var contains invalid JSON');
    }
  }

  // Option 2: File path (local development)
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
  try {
    const { readFileSync } = require('fs') as typeof import('fs');
    return JSON.parse(readFileSync(serviceAccountPath, 'utf-8')) as admin.ServiceAccount;
  } catch {
    throw new Error(
      `Firebase initialization failed. Set FIREBASE_SERVICE_ACCOUNT env var (JSON string) or ensure ${serviceAccountPath} exists.`
    );
  }
}

function initializeFirebase() {
  if (initialized) return;

  const serviceAccount = loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket,
  });

  initialized = true;
  console.log('[Firebase] Initialized successfully');
  console.log(`[Firebase] Using Firestore database: "${firestoreDatabaseId}"`);
}

initializeFirebase();

// Use the named database ID (your DB is named "recruitment", not "(default)")
export const db = admin.firestore();
db.settings({ databaseId: firestoreDatabaseId, ignoreUndefinedProperties: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bucket: ReturnType<ReturnType<typeof admin.storage>['bucket']> = admin.storage().bucket(storageBucket);

// Collection references
export const chatsCollection = db.collection('chats');

export function chatFilesCollection(chatId: string) {
  return db.collection('chats').doc(chatId).collection('files');
}

export function chatMessagesCollection(chatId: string) {
  return db.collection('chats').doc(chatId).collection('messages');
}
