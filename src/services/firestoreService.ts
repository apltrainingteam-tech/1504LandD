import { initializeApp } from 'firebase/app';
import { 
  getFirestore,
  collection, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  doc, 
  setDoc,
  DocumentData
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const getCollection = async (colName: string): Promise<DocumentData[]> => {
  const snapshot = await getDocs(collection(db, colName));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const queryByField = async (colName: string, field: string, value: any): Promise<DocumentData[]> => {
  const q = query(collection(db, colName), where(field, "==", value));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const addBatch = async (colName: string, items: any[]): Promise<void> => {
  const batch = writeBatch(db);
  items.forEach(item => {
    const dRef = doc(collection(db, colName), item.id);
    batch.set(dRef, item);
  });
  await batch.commit();
};

export const upsertDoc = async (colName: string, id: string, data: any): Promise<void> => {
  const dRef = doc(db, colName, id);
  await setDoc(dRef, data, { merge: true });
};
