import { SNAPSHOT_ENABLED } from '../constants/debugConfig';

const snapshots: Record<string, any> = {};

export function saveSnapshot(key: string, data: any) {
  if (!SNAPSHOT_ENABLED) return;
  
  try {
    snapshots[key] = JSON.parse(JSON.stringify(data)); // structuredClone might fail on some objects
  } catch (e) {
    console.warn(`[Snapshot] Failed to save snapshot for ${key}`, e);
  }
}

export function getSnapshot(key: string) {
  return snapshots[key];
}

export function getAllSnapshots() {
  return { ...snapshots };
}

export function clearSnapshots() {
  Object.keys(snapshots).forEach(key => delete snapshots[key]);
}
