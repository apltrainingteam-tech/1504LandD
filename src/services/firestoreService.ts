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
  deleteDoc,
  DocumentData
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBoSFLhMQCd6vN7L9lO2MvkqBiHnhJCqHk",
  authDomain: "pharmaintel-9b60c.firebaseapp.com",
  projectId: "pharmaintel-9b60c",
  storageBucket: "pharmaintel-9b60c.firebasestorage.app",
  messagingSenderId: "97794894089",
  appId: "1:97794894089:web:019d24130cdbfdc0f30bd8",
  measurementId: "G-Z3V8M55HS7"
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

export const deleteDocument = async (colName: string, id: string): Promise<void> => {
  if (!id) throw new Error("Missing document ID");
  const dRef = doc(db, colName, id);
  await deleteDoc(dRef);
};
