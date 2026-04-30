import { Router, Request, Response } from 'express';
import { findByQuery, updateByQuery } from './mongodbService.js';

const router = Router();

/**
 * POST /api/training/cancel
 * Atomic cancellation of a training batch
 */
router.post('/cancel', async (req: Request, res: Response) => {
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
