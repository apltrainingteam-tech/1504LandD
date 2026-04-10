import { doc, setDoc } from 'firebase/firestore';
import { db, upsertDoc } from './services/firestoreService';
import { mockEmployees, mockAttendance, mockScores, mockNominations, mockDemographics } from './api.mock';
import { STATE_ZONE, TEAM_CLUSTER, DESIGNATIONS, TRAINERS } from './seed/masterData';

export const seedDatabase = async () => {
  console.log("Seeding base mock data started...");

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

  console.log("Base mock data seeding completed successfully!");
};

export const seedMasterData = async () => {
  try {
    console.log("Master Data Seeding started...");

    // STATE-ZONE
    console.log("Seeding state_zone...");
    for (const s of STATE_ZONE) {
      await upsertDoc('state_zone', s.state, s);
    }

    // TEAM-CLUSTER
    console.log("Seeding team_cluster_mapping...");
    for (const t of TEAM_CLUSTER) {
      await upsertDoc('team_cluster_mapping', t.id, t);
    }

    // DESIGNATIONS
    console.log("Seeding designations...");
    for (const d of DESIGNATIONS) {
      await upsertDoc('designations', d, { name: d });
    }

    // TRAINERS
    console.log("Seeding trainers...");
    for (const tr of TRAINERS) {
      await upsertDoc('trainers', tr.id, tr);
    }

    console.log("Master Data Seeding completed successfully!");
    alert("Master Data Seeded Successfully! Refreshing tables...");
    return true;
  } catch (err: any) {
    console.error("Master Data Seeding failed:", err);
    alert("Seeding Failed: " + (err.message || "Unknown error"));
    return false;
  }
};
