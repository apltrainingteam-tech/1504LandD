import { Router, Request, Response } from 'express';
import { findByQuery, updateByQuery, getDb } from './mongodbService.js';

const router = Router();

/**
 * POST /api/training-data/bulk-overwrite
 * Atomic field-level overwrite for training attendance records
 */
router.post('/training-data/bulk-overwrite', async (req: Request, res: Response) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ success: false, error: 'updates array is required' });
    }

    console.log(`[BULK SAVE] Processing ${updates.length} field updates`);

    const db = await getDb();
    const collection = db.collection('training_data');

    // Build atomic bulk operations
    const operations = updates.map(u => ({
      updateOne: {
        filter: { 
          trainingId: u.trainingId, 
          employeeId: String(u.employeeId) 
        },
        update: { 
          $set: { 
            [u.field]: u.newValue,
            updatedAt: new Date().toISOString()
          } 
        },
        upsert: true // Create if missing (e.g. for planned batches not yet in training_data)
      }
    }));

    const result = await collection.bulkWrite(operations, { ordered: false });
    
    console.log(`[BULK SAVE] Success: ${result.modifiedCount} updated, ${result.upsertedCount} upserted`);

    // --- Record ChangeSet ---
    try {
      const changeSetCollection = db.collection('change_sets');
      const createdAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(createdAt.getDate() + 30); // Expires in 30 days

      const changeSet = {
        entity: 'TrainingData',
        changes: updates,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        metadata: {
          modifiedCount: result.modifiedCount,
          upsertedCount: result.upsertedCount
        }
      };

      await changeSetCollection.insertOne(changeSet);

      // Keep only last 10 changesets for this entity
      const oldSets = await changeSetCollection
        .find({ entity: 'TrainingData' })
        .sort({ createdAt: -1 })
        .skip(10)
        .toArray();

      if (oldSets.length > 0) {
        const idsToDelete = oldSets.map(s => s._id);
        await changeSetCollection.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`[BULK SAVE] Pruned ${idsToDelete.length} old ChangeSets`);
      }
    } catch (csError) {
      console.error('[CHANGE SET ERROR] Failed to record change log:', csError);
      // Non-blocking: we still return success for the main update
    }

    res.json({ 
      success: true, 
      matchedCount: result.matchedCount, 
      modifiedCount: result.modifiedCount,
      upsertedCount: result.upsertedCount
    });
  } catch (error: any) {
    console.error('[BULK SAVE ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/training/cancel
 * Atomic cancellation of a training batch
 */
router.post('/training/cancel', async (req: Request, res: Response) => {
  try {
    const { trainingId } = req.body;
    if (!trainingId) {
      return res.status(400).json({ success: false, error: 'trainingId is required' });
    }

    console.log(`[CANCEL] Processing cancellation for trainingId: ${trainingId}`);

    // 1. Validate no TrainingData exists
    // We check both 'training_data' (legacy/imported) and 'training_batches' (new flow)
    const [trainingDataEntries, batchAttendance] = await Promise.all([
      findByQuery('training_data', { trainingId }),
      findByQuery('training_batches', { trainingId })
    ]);

    const hasTrainingData = trainingDataEntries.length > 0;
    const hasBatchAttendance = (batchAttendance || []).some((batch: any) =>
      Array.isArray(batch.candidates) &&
      batch.candidates.some((candidate: any) => candidate.attendance && candidate.attendance !== 'pending')
    );

    if (hasTrainingData || hasBatchAttendance) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cannot cancel. Attendance already marked.' 
      });
    }

    // 2. Update TrainingPlan (nomination_drafts)
    await updateByQuery('nomination_drafts', 
      { trainingId }, 
      { 
        status: 'Cancelled', 
        isCancelled: true,
        cancelledAt: new Date().toISOString()
      }
    );

    // 3. Update Notification History (notification_history)
    await updateByQuery('notification_history', 
      { trainingId }, 
      { 
        finalStatus: 'VOID', 
        isVoided: true 
      }
    );

    // 4. Update Nominations (if they exist in a separate collection)
    await updateByQuery('nominations', 
      { trainingId }, 
      { isVoided: true }
    );

    res.json({ success: true, message: 'Training cancelled successfully' });
  } catch (error: any) {
    console.error('[CANCEL ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
