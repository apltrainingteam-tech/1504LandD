import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  update,
  remove
} from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyBoSFLhMQCd6vN7L9lO2MvkqBiHnhJCqHk",
  authDomain: "pharmaintel-9b60c.firebaseapp.com",
  projectId: "pharmaintel-9b60c",
  storageBucket: "pharmaintel-9b60c.firebasestorage.app",
  messagingSenderId: "97794894089",
  appId: "1:97794894089:web:019d24130cdbfdc0f30bd8",
  databaseURL: "https://pharmaintel-9b60c-default-rtdb.firebaseio.com/",
  measurementId: "G-Z3V8M55HS7"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);


// 🔹 GET ENTIRE COLLECTION (NODE)
export const getCollection = async (path: string): Promise<any[]> => {
  const snapshot = await get(ref(db, path));
  if (!snapshot.exists()) return [];

  const data = snapshot.val();
  
  // Firebase can sometimes return a sparse array if document IDs are numeric!
  if (Array.isArray(data)) {
    return data.map((value, idx) => {
      if (!value) return null;
      return { id: String(idx), ...(value as object) };
    }).filter(Boolean) as any[];
  }

  return Object.entries(data).map(([id, value]) => ({
    id,
    ...(value as object)
  }));
};


// 🔹 QUERY (CLIENT-SIDE FILTER)
export const queryByField = async (
  path: string,
  field: string,
  value: any
): Promise<any[]> => {
  const all = await getCollection(path);
  return all.filter(item => item[field] === value);
};


// 🔹 BATCH WRITE (SIMULATED)
export const addBatch = async (path: string, items: any[]): Promise<void> => {
  const updates: any = {};

  items.forEach(item => {
    let id = item.id || push(ref(db, path)).key;
    if (typeof id === 'string') id = id.replace(/[.#$\[\]]/g, '_');
    updates[`${path}/${id}`] = item;
  });

  await update(ref(db), updates);
};


// 🔹 CLEAR ENTIRE COLLECTION
export const clearCollection = async (path: string): Promise<void> => {
  await set(ref(db, path), null);
};

// 🔹 UPSERT (CORE FUNCTION)
export const upsertDoc = async (
  path: string,
  id: string,
  data: any
): Promise<void> => {

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("RTDB connection timed out. Check API key / network.")), 10000)
  );

  const safeId = typeof id === 'string' ? id.replace(/[.#$\[\]]/g, '_') : id;

  await Promise.race([
    update(ref(db, `${path}/${safeId}`), data), // merge behavior
    timeout
  ]);
};

// 🔹 SINGLE DOCUMENT DELETE
export const deleteDocument = async (path: string, id: string): Promise<void> => {
  if (!id) throw new Error("Missing document ID");
  const safeId = typeof id === 'string' ? id.replace(/[.#$\[\]]/g, '_') : id;
  await remove(ref(db, `${path}/${safeId}`));
};

// 🔹 DELETE RECORDS (BY FIELD VALUES)
export const deleteRecordsByQuery = async (
  path: string,
  field: string,
  values: string[]
): Promise<number> => {
  const all = await getCollection(path);
  const targets = all.filter(item => values.includes(item[field]));
  
  if (targets.length === 0) return 0;

  const updates: any = {};
  targets.forEach(item => {
    updates[`${path}/${item.id}`] = null;
  });

  await update(ref(db), updates);
  return targets.length;
};
