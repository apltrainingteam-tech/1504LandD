import { SNAPSHOT_ENABLED } from "../constants/debugConfig";

const snapshots: Record<string, any> = {};

export function saveSnapshot(key: string, data: any) {
  if (!SNAPSHOT_ENABLED) return;
  try {
    snapshots[key] = structuredClone(data);
  } catch (e) {
    console.warn(`[Snapshot] Failed to clone data for key: ${key}`, e);
    // Fallback if structuredClone fails (e.g. for non-serializable objects)
    snapshots[key] = data; 
  }
}

export function getSnapshot(key: string) {
  return snapshots[key];
}

export function getAllSnapshots() {
  return snapshots;
}

export function clearSnapshots() {
  Object.keys(snapshots).forEach(key => delete snapshots[key]);
}
