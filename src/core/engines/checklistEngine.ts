import { getCollection, upsertDoc, findByQuery } from './apiClient';
import { ChecklistItem, ChecklistTemplate, ChecklistTaskTemplate } from '../../types/checklist';

/**
 * CHECKLIST GENERATION ENGINE
 * 
 * Responsibilities:
 * 1. Generate checklist items based on Training Type templates.
 * 2. Ensure idempotency (no duplicates for same trainingId).
 * 3. Calculate due dates based on trigger date and task offsets.
 */

export interface ChecklistTrigger {
  trainingId: string;
  trainingType: string;
  trainer: string;
  trainingDate: string;
}

export const generateChecklistForTraining = async (trigger: ChecklistTrigger) => {
  const { trainingId, trainingType, trainer, trainingDate } = trigger;

  if (!trainingId || !trainingType) {
    console.warn('[ChecklistEngine] Missing required fields', trigger);
    return;
  }

  try {
    // 1. Safety Check: Does checklist already exist?
    const existing = await findByQuery('checklist_items', { trainingId });
    if (existing && existing.length > 0) {
      console.log(`[ChecklistEngine] Checklist already exists for ${trainingId}. Skipping.`);
      return;
    }

    // 2. Fetch Template
    const templates = await getCollection('checklist_templates');
    const normalizedType = trainingType.trim().toLowerCase();
    
    const template = templates.find((t: ChecklistTemplate) => 
      t.trainingType.trim().toLowerCase() === normalizedType
    );

    if (!template) {
      console.warn(`[ChecklistEngine] No template found for type: ${trainingType} (normalized: ${normalizedType})`);
      return;
    }

    // 3. Generate Items
    const newItems: ChecklistItem[] = template.tasks.map((task: ChecklistTaskTemplate) => {
      const dueDate = new Date(trainingDate);
      dueDate.setDate(dueDate.getDate() + (task.defaultOffsetDays || 0));

      return {
        id: `cli-${trainingId}-${task.id}`,
        trainingId,
        trainingType,
        taskName: task.taskName,
        assignee: task.defaultAssignee === 'Trainer' ? trainer : task.defaultAssignee,
        dueDate: dueDate.toISOString(),
        status: 'Pending'
      };
    });

    // 4. Persist Items
    for (const item of newItems) {
      await upsertDoc('checklist_items', item.id, item);
    }

    console.log(`[ChecklistEngine] Successfully generated ${newItems.length} tasks for ${trainingId}`);
    return newItems;
  } catch (error) {
    console.error('[ChecklistEngine] Failed to generate checklist', error);
    throw error;
  }
};
