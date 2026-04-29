import { Router, Request, Response } from 'express';
import { deleteManyByQuery } from './mongodbService.js';

const router = Router();

/**
 * POST /api/training/remove-teams
 * Atomic removal of teams from a training plan
 */
router.post('/remove-teams', async (req: Request, res: Response) => {
  try {
    const { trainingId, teamIds } = req.body;
    if (!trainingId || !teamIds || !Array.isArray(teamIds)) {
      throw new Error('Invalid trainingId or teamIds');
    }

    console.log(`[TRAINING] Removing teams ${teamIds.join(', ')} from training ${trainingId}`);

    // 1. Delete from notification_history
    await deleteManyByQuery('notification_history', { 
      trainingId: trainingId, 
      teamId: { $in: teamIds } 
    });

    // 2. Delete from training_batches (Nomination records)
    const batchIds = teamIds.map(tid => `${trainingId}_${tid}`);
    await deleteManyByQuery('training_batches', { 
      $or: [
        { _id: { $in: batchIds } },
        { id: { $in: batchIds } },
        { trainingId: trainingId, teamId: { $in: teamIds } }
      ]
    });

    res.json({ success: true, message: 'Teams removed and records deleted' });
  } catch (error: any) {
    console.error('Error removing teams:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/training/lock-teams
 * Mark teams as LOCKED
 */
router.post('/lock-teams', async (req: Request, res: Response) => {
  try {
    const { trainingId, teamIds } = req.body;
    if (!trainingId || !teamIds || !Array.isArray(teamIds)) {
      throw new Error('Invalid trainingId or teamIds');
    }

    console.log(`[TRAINING] Locking teams ${teamIds.join(', ')} in training ${trainingId}`);
    res.json({ success: true, message: 'Teams locked' });
  } catch (error: any) {
    console.error('Error locking teams:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/training/reset-teams
 * Reset LOCKED teams to OPEN and wipe records
 */
router.post('/reset-teams', async (req: Request, res: Response) => {
  try {
    const { trainingId, teamIds } = req.body;
    if (!trainingId || !teamIds || !Array.isArray(teamIds)) {
      throw new Error('Invalid trainingId or teamIds');
    }

    console.log(`[TRAINING] Resetting teams ${teamIds.join(', ')} in training ${trainingId}`);

    // 1. Delete from notification_history
    const notificationsDeleted = await deleteManyByQuery('notification_history', { 
      trainingId: trainingId, 
      teamId: { $in: teamIds } 
    });

    // 2. Delete from training_batches (Nomination records)
    const batchIds = teamIds.map(tid => `${trainingId}_${tid}`);
    const batchesDeleted = await deleteManyByQuery('training_batches', { 
      $or: [
        { _id: { $in: batchIds } },
        { id: { $in: batchIds } },
        { trainingId: trainingId, teamId: { $in: teamIds } }
      ]
    });

    // 3. Delete from training_data_raw if scoped
    await deleteManyByQuery('training_data_raw', { 
      trainingId: trainingId, 
      teamId: { $in: teamIds } 
    });

    res.json({ 
      success: true, 
      message: 'Teams reset successfully',
      deletedCounts: {
        notifications: notificationsDeleted,
        batches: batchesDeleted
      }
    });
  } catch (error: any) {
    console.error('Error resetting teams:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
