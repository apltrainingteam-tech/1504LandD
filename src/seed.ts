import { upsertDoc } from './services/apiClient';
import { mockEmployees, mockAttendance, mockScores, mockNominations, mockDemographics } from './api.mock';
import { STATE_ZONE, DESIGNATIONS, TRAINERS } from './seed/masterData';

/**
 * Sequential batch write with delays
 */
const batchWrite = async (items: any[], collectionName: string, keyField: string) => {
  for (const item of items) {
    const id = item[keyField];
    await upsertDoc(collectionName, id, item);

    // small delay to prevent overload
    await new Promise(res => setTimeout(res, 50));
  }
};

/**
 * Safe version of base mock data seeding
 */
export const seedDatabase = async () => {
  try {
    console.log("Seeding base mock data started...");

    await batchWrite(mockEmployees, 'employees', 'id');
    await batchWrite(mockAttendance, 'attendance', 'id');
    await batchWrite(mockScores, 'training_scores', 'id');
    await batchWrite(mockNominations, 'training_nominations', 'id');
    await batchWrite(mockDemographics, 'demographics', 'id');

    console.log("Base mock data seeding completed successfully!");
    return true;
  } catch (err: any) {
    console.error("Base seeding failed:", err);
    return false;
  }
};

/**
 * Safe version of master data seeding
 */
export const seedMasterData = async () => {
  try {
    console.log("Master Data Seeding started...");

    await batchWrite(STATE_ZONE, 'state_zone', 'state');

    for (const d of DESIGNATIONS) {
      await upsertDoc('designations', d, { name: d });
      await new Promise(res => setTimeout(res, 20));
    }

    await batchWrite(TRAINERS, 'trainers', 'id');

    console.log("Seeding completed");
    alert("Master Data Seeded Successfully!");

    return true;

  } catch (err: any) {
    console.error("Seeding failed:", err);
    alert("Error: " + err.message);
    return false;
  }
};
