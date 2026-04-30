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
    
    // Operations for training_data (flat structure)
    const tdOps = updates.map(u => {
      const setObj: any = { 
        [u.field]: u.newValue,
        updatedAt: new Date().toISOString()
      };
      
      // Handle meta for isVoided
      if (u.field === 'isVoided' && u.meta) {
        setObj.voidedAt = u.meta.voidedAt;
        setObj.voidReason = u.meta.voidReason;
      }

      return {
        updateOne: {
          filter: { trainingId: u.trainingId, employeeId: String(u.employeeId) },
          update: { $set: setObj },
          upsert: true
        }
      };
    });

    // Operations for training_batches (nested array structure)
    const batchOps = updates.map(u => {
      const fieldName = u.field === 'attendanceStatus' ? 'attendance' : u.field;
      const setObj: any = { 
        [`candidates.$.${fieldName}`]: u.newValue,
        updatedAt: new Date().toISOString()
      };

      if (u.field === 'isVoided' && u.meta) {
        setObj[`candidates.$.voidedAt`] = u.meta.voidedAt;
        setObj[`candidates.$.voidReason`] = u.meta.voidReason;
      }

      return {
        updateOne: {
          filter: { id: u.trainingId, "candidates.empId": String(u.employeeId) },
          update: { $set: setObj }
        }
      };
    });

    // Execute both in parallel
    const [tdResult, batchResult] = await Promise.all([
      db.collection('training_data').bulkWrite(tdOps, { ordered: false }),
      db.collection('training_batches').bulkWrite(batchOps, { ordered: false })
    ]);
    
    console.log(`[BULK SAVE] TD: ${tdResult.modifiedCount} mod, ${tdResult.upsertedCount} ups. Batches: ${batchResult.modifiedCount} mod`);

    // --- Record ChangeSet ---
    try {
      const changeSetCollection = db.collection('change_sets');
      const createdAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(createdAt.getDate() + 30);

      const changeSet = {
        entity: 'TrainingData',
        changes: updates,
        createdAt: createdAt.toISOString(),
        expiresAt: expiresAt.toISOString(),
        metadata: {
          tdMatched: tdResult.matchedCount,
          batchMatched: batchResult.matchedCount
        }
      };

      await changeSetCollection.insertOne(changeSet);
    } catch (csError) {
      console.error('[CHANGE SET ERROR] Failed to record change log:', csError);
    }

    res.json({ 
      success: true, 
      tdMatched: tdResult.matchedCount, 
      batchMatched: batchResult.matchedCount
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

/**
 * POST /api/training-data/rollback
 * Reverts the most recent bulk update using the last ChangeSet
 */
router.post('/training-data/rollback', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const changeSetCollection = db.collection('change_sets');

    // 1. Get latest ChangeSet
    const lastSet = await changeSetCollection
      .find({ entity: 'TrainingData' })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    if (lastSet.length === 0) {
      return res.status(404).json({ success: false, error: 'No recent changes found to revert.' });
    }

    const set = lastSet[0];
    const updates = set.changes; // These are the forward changes

    console.log(`[ROLLBACK] Reverting ChangeSet ${set._id} (${updates.length} field updates)`);

    // 2. Prepare inverse operations (apply oldValue)
    const tdOps = updates.map((u: any) => ({
      updateOne: {
        filter: { trainingId: u.trainingId, employeeId: String(u.employeeId) },
        update: { 
          $set: { 
            [u.field]: u.oldValue,
            updatedAt: new Date().toISOString()
          } 
        }
      }
    }));

    const batchOps = updates.map((u: any) => {
      const fieldName = u.field === 'attendanceStatus' ? 'attendance' : u.field;
      return {
        updateOne: {
          filter: { id: u.trainingId, "candidates.empId": String(u.employeeId) },
          update: { 
            $set: { 
              [`candidates.$.${fieldName}`]: u.oldValue,
              updatedAt: new Date().toISOString()
            } 
          }
        }
      };
    });

    // 3. Execute rollback
    await Promise.all([
      db.collection('training_data').bulkWrite(tdOps, { ordered: false }),
      db.collection('training_batches').bulkWrite(batchOps, { ordered: false })
    ]);

    // 4. Remove the ChangeSet so it can't be rolled back twice
    await changeSetCollection.deleteOne({ _id: set._id });

    res.json({ success: true, message: 'Rollback complete' });
  } catch (error: any) {
    console.error('[ROLLBACK ERROR]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;

