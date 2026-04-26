import { upsertDoc } from './core/engines/apiClient';
import { STATE_ZONE, DESIGNATIONS, TRAINERS } from './seed/masterData';

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

