import { ref, get, set, push, child } from 'firebase/database';
import { db } from './firebase';
import { Employee, Attendance, TrainingScore, TrainingNomination, TrainingType } from './types';

// Helper to convert Firebase object collections to arrays
const toArray = <T>(obj: any): T[] => {
    if (!obj) return [];
    return Object.keys(obj).map(key => ({
        ...obj[key],
        id: obj[key].id || key // Use existing id or key
    }));
};

export const api = {
    getEmployees: async (): Promise<Employee[]> => {
        const snapshot = await get(ref(db, 'employees'));
        return toArray<Employee>(snapshot.val());
    },

    getAttendanceByTab: async (tab: TrainingType): Promise<Attendance[]> => {
        const snapshot = await get(ref(db, 'attendance'));
        const allAtt = toArray<Attendance>(snapshot.val());
        return allAtt.filter(a => a.trainingType === tab);
    },

    getAllAttendance: async (): Promise<Attendance[]> => {
        const snapshot = await get(ref(db, 'attendance'));
        return toArray<Attendance>(snapshot.val());
    },

    getScoresByType: async (tab: TrainingType): Promise<TrainingScore[]> => {
        const snapshot = await get(ref(db, 'training_scores'));
        const allSc = toArray<TrainingScore>(snapshot.val());
        return allSc.filter(s => s.trainingType === tab);
    },

    getAllScores: async (): Promise<TrainingScore[]> => {
        const snapshot = await get(ref(db, 'training_scores'));
        return toArray<TrainingScore>(snapshot.val());
    },

    getNominationsByType: async (tab: TrainingType): Promise<TrainingNomination[]> => {
        const snapshot = await get(ref(db, 'training_nominations'));
        const allNom = toArray<TrainingNomination>(snapshot.val());
        return allNom.filter(n => n.trainingType === tab);
    },

    // Save functions
    saveEmployee: async (emp: Employee) => {
        return set(ref(db, `employees/${emp.id}`), emp);
    },

    saveAttendance: async (att: Attendance) => {
        const newRef = att.id ? ref(db, `attendance/${att.id}`) : push(ref(db, 'attendance'));
        const data = { ...att, id: att.id || newRef.key };
        return set(newRef, data);
    },

    saveScore: async (score: TrainingScore) => {
        return set(ref(db, `training_scores/${score.id}`), score);
    }
};
