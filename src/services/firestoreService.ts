import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  getDoc
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBoSFLhMQCd6vN7L9lO2MvkqBiHnhJCqHk",
  authDomain: "pharmaintel-9b60c.firebaseapp.com",
  projectId: "pharmaintel-9b60c",
  storageBucket: "pharmaintel-9b60c.firebasestorage.app",
  messagingSenderId: "97794894089",
  appId: "1:97794894089:web:019d24130cdbfdc0f30bd8",
  // Removed databaseURL as it's not needed for Firestore
  measurementId: "G-Z3V8M55HS7"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

console.log('Firebase initialized successfully with config:', firebaseConfig);


// 🔹 GET ENTIRE COLLECTION (Firestore)
export const getCollection = async (path: string): Promise<any[]> => {
  console.log(`Fetching collection from path: ${path}`);
  try {
    const querySnapshot = await getDocs(collection(db, path));
    console.log(`QuerySnapshot size: ${querySnapshot.size}`);
    if (querySnapshot.empty) {
      console.log(`No documents found in collection: ${path}`);
      return [];
    }

    const result = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log(`Converted ${path} to array with length ${result.length}`);
    if (result[0]) console.log(`Sample ${path}[0] keys:`, Object.keys(result[0]));
    return result;
  } catch (error) {
    console.error(`Error fetching collection from ${path}:`, error);
    throw error;
  }
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


// 🔹 BATCH WRITE (Firestore)
export const addBatch = async (path: string, items: any[]): Promise<void> => {
  console.log(`Batch writing ${items.length} items to ${path}`);
  try {
    const batch = writeBatch(db);
    items.forEach(item => {
      const docRef = item.id ? doc(db, path, item.id) : doc(collection(db, path));
      batch.set(docRef, item);
    });
    await batch.commit();
    console.log(`Successfully batch wrote ${items.length} items to ${path}`);
  } catch (error) {
    console.error(`Error batch writing to ${path}:`, error);
    throw error;
  }
};


// 🔹 CLEAR ENTIRE COLLECTION (Firestore)
export const clearCollection = async (path: string): Promise<void> => {
  console.log(`Clearing collection: ${path}`);
  try {
    const querySnapshot = await getDocs(collection(db, path));
    if (querySnapshot.empty) {
      console.log(`Collection ${path} is already empty`);
      return;
    }
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Successfully cleared ${querySnapshot.size} documents from ${path}`);
  } catch (error) {
    console.error(`Error clearing collection ${path}:`, error);
    throw error;
  }
};

// 🔹 CLEAR COLLECTION BY FIELD VALUE (Firestore)
export const clearCollectionByField = async (
  path: string,
  field: string,
  value: any
): Promise<number> => {
  console.log(`Clearing documents in ${path} where ${field} == ${value}`);
  try {
    const q = query(collection(db, path), where(field, '==', value));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      console.log(`No matching documents found in ${path} for ${field} == ${value}`);
      return 0;
    }
    const batch = writeBatch(db);
    querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    console.log(`Successfully cleared ${querySnapshot.size} documents from ${path} where ${field} == ${value}`);
    return querySnapshot.size;
  } catch (error) {
    console.error(`Error clearing documents in ${path} where ${field} == ${value}:`, error);
    throw error;
  }
};

// 🔹 UPSERT (CORE FUNCTION) (Firestore)
export const upsertDoc = async (
  path: string,
  id: string,
  data: any
): Promise<void> => {
  console.log(`Upserting document ${id} in ${path}`);
  try {
    const docRef = doc(db, path, id);
    await setDoc(docRef, data, { merge: true });
    console.log(`Successfully upserted document ${id} in ${path}`);
  } catch (error) {
    console.error(`Error upserting document ${id} in ${path}:`, error);
    throw error;
  }
};

// 🔹 SINGLE DOCUMENT DELETE (Firestore)
export const deleteDocument = async (path: string, id: string): Promise<void> => {
  if (!id) throw new Error("Missing document ID");
  console.log(`Deleting document ${id} from ${path}`);
  try {
    const docRef = doc(db, path, id);
    await deleteDoc(docRef);
    console.log(`Successfully deleted document ${id} from ${path}`);
  } catch (error) {
    console.error(`Error deleting document ${id} from ${path}:`, error);
    throw error;
  }
};

// 🔹 DELETE RECORDS (BY FIELD VALUES) (Firestore)
export const deleteRecordsByQuery = async (
  path: string,
  field: string,
  values: string[]
): Promise<number> => {
  console.log(`Deleting records from ${path} where ${field} in [${values.join(', ')}]`);
  try {
    const all = await getCollection(path);
    const targets = all.filter(item => values.includes(item[field]));
    console.log(`Found ${targets.length} records to delete`);

    if (targets.length === 0) return 0;

    const batch = writeBatch(db);
    targets.forEach(item => {
      const docRef = doc(db, path, item.id);
      batch.delete(docRef);
    });
    await batch.commit();
    console.log(`Successfully deleted ${targets.length} records from ${path}`);
    return targets.length;
  } catch (error) {
    console.error(`Error deleting records from ${path}:`, error);
    throw error;
  }
};
