import type { DriveData } from '../types/drive.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeObjects(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceVal = source[key];
    const targetVal = result[key];

    if (sourceVal === null || sourceVal === undefined) {
      continue;
    }

    if (isPlainObject(sourceVal) && isPlainObject(targetVal)) {
      result[key] = mergeObjects(targetVal, sourceVal);
    } else {
      result[key] = sourceVal;
    }
  }

  return result;
}

/**
 * Deep merges two DriveData objects. Values from `source` override `target`
 * only when the source value is non-null and non-undefined.
 * Arrays are replaced (not concatenated) when source has a value.
 */
export function mergeDriveData(
  target: Partial<DriveData>,
  source: Partial<DriveData>
): Partial<DriveData> {
  return mergeObjects(
    target as Record<string, unknown>,
    source as Record<string, unknown>
  ) as Partial<DriveData>;
}

/**
 * Applies user answers to drive data. Answers are keyed by dot-path
 * (e.g. "setupDetails.candidateType" → value).
 */
export function applyAnswersToDriveData(
  driveData: Partial<DriveData>,
  answers: Record<string, unknown>
): Partial<DriveData> {
  const result = JSON.parse(JSON.stringify(driveData)) as Record<string, unknown>;

  for (const [dotPath, value] of Object.entries(answers)) {
    if (value === null || value === undefined) continue;

    const parts = dotPath.split('.');
    let current = result;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part] || typeof current[part] !== 'object') {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
  }

  return result as Partial<DriveData>;
}
