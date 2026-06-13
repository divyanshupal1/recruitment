/**
 * Migration script: Uploads college data from mock_db.py into Firestore `colleges` collection.
 *
 * Usage:  npx tsx scripts/migrate-colleges.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Firebase bootstrap (reuses project config) ──────────────────────────
import '../src/lib/firebase.js';
import { db } from '../src/lib/firebase.js';

import type { College } from '../src/types/college.js';

// ── Step 1: Parse mock_db.py → JSON ─────────────────────────────────────

function parseMockDb(): College[] {
  const filePath = resolve(import.meta.dirname ?? '.', '../college-predictor-ph_kk_1/mock_db.py');
  const raw = readFileSync(filePath, 'utf-8');

  // Extract the LARGE_COLLEGES_DATA list by finding its boundaries
  const startMarker = 'LARGE_COLLEGES_DATA = [';
  const startIdx = raw.indexOf(startMarker);
  if (startIdx === -1) throw new Error('Could not find LARGE_COLLEGES_DATA in mock_db.py');

  // Find the matching closing bracket
  let depth = 0;
  let jsonStart = startIdx + startMarker.length - 1; // position of '['
  let jsonEnd = -1;

  for (let i = jsonStart; i < raw.length; i++) {
    if (raw[i] === '[') depth++;
    else if (raw[i] === ']') {
      depth--;
      if (depth === 0) {
        jsonEnd = i + 1;
        break;
      }
    }
  }

  if (jsonEnd === -1) throw new Error('Could not find closing bracket for LARGE_COLLEGES_DATA');

  let jsonStr = raw.slice(jsonStart, jsonEnd);

  // Python → JSON transformations
  jsonStr = jsonStr.replace(/True/g, 'true');
  jsonStr = jsonStr.replace(/False/g, 'false');
  jsonStr = jsonStr.replace(/None/g, 'null');
  // Remove trailing commas before } or ]
  jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1');

  const data: College[] = JSON.parse(jsonStr);
  return data;
}

// ── Step 2: Upload to Firestore ─────────────────────────────────────────

async function migrate() {
  console.log('📚 Parsing mock_db.py …');
  const colleges = parseMockDb();
  console.log(`   Found ${colleges.length} college records.\n`);

  const collectionRef = db.collection('colleges');

  // Firestore batched writes (max 500 per batch)
  const BATCH_SIZE = 450;
  let uploaded = 0;

  for (let i = 0; i < colleges.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = colleges.slice(i, i + BATCH_SIZE);

    for (const college of chunk) {
      const docRef = collectionRef.doc(college.id);
      batch.set(docRef, college);
    }

    await batch.commit();
    uploaded += chunk.length;
    console.log(`   ✅ Uploaded ${uploaded} / ${colleges.length} colleges`);
  }

  console.log('\n🎉 Migration complete!');
  process.exit(0);
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
