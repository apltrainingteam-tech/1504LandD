import { doc, setDoc } from 'firebase/firestore';
import { db } from './services/firestoreService';
import { mockEmployees, mockAttendance, mockScores, mockNominations, mockDemographics } from '../api.mock';

export const seedDatabase = async () => {
    console.log("Seeding started...");
    
    for (const e of mockEmployees) {
        await setDoc(doc(db, 'employees', e.id), e);
    }
    
    for (const a of mockAttendance) {
        await setDoc(doc(db, 'attendance', a.id), a);
    }
    
    for (const s of mockScores) {
        await setDoc(doc(db, 'training_scores', s.id), s);
    }
    
    for (const n of mockNominations) {
        await setDoc(doc(db, 'training_nominations', n.id), n);
    }

    for (const d of mockDemographics) {
        await setDoc(doc(db, 'demographics', d.id), d);
    }
    
    console.log("Seeding completed successfully!");
};
