import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json';
const storageBucket = process.env.FIREBASE_STORAGE_BUCKET;
const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';

let initialized = false;

function initializeFirebase() {
  if (initialized) return;

  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket,
    });

    initialized = true;
    console.log('[Firebase] Initialized successfully');
    console.log(`[Firebase] Using Firestore database: "${firestoreDatabaseId}"`);
  } catch (error) {
    console.error('[Firebase] Failed to initialize:', error);
    throw new Error(
      `Firebase initialization failed. Ensure ${serviceAccountPath} exists and FIREBASE_STORAGE_BUCKET is set.`
    );
  }
}

initializeFirebase();

// Use the named database ID (your DB is named "recruitment", not "(default)")
export const db = admin.firestore();
db.settings({ databaseId: firestoreDatabaseId, ignoreUndefinedProperties: true });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const bucket: ReturnType<ReturnType<typeof admin.storage>['bucket']> = admin.storage().bucket('recruitment-75766.firebasestorage.app');

// Collection references
export const chatsCollection = db.collection('chats');

export function chatFilesCollection(chatId: string) {
  return db.collection('chats').doc(chatId).collection('files');
}

export function chatMessagesCollection(chatId: string) {
  return db.collection('chats').doc(chatId).collection('messages');
}
