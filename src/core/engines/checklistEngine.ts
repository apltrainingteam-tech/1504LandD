import { getCollection, upsertDoc, findByQuery } from './apiClient';
import { ChecklistItem, ChecklistTemplate, ChecklistTaskTemplate, ChecklistType } from '../../types/checklist';

/**
 * CHECKLIST GENERATION ENGINE
 * 
 * Responsibilities:
 * 1. Generate checklist items based on Training Type templates.
 * 2. Ensure idempotency (no duplicates for same trainingId).
 * 3. Calculate due dates based on trigger date and task offsets.
 */

export interface ChecklistTrigger {
  parentId: string;
  checklistType: ChecklistType;
  key: string;
  trainer?: string; // Default trainer if applicable
  triggerDate: string;
}

export const generateChecklistForTraining = async (trigger: ChecklistTrigger) => {
  const { parentId, checklistType, key, trainer, triggerDate } = trigger;

  if (!parentId || !checklistType || !key) {
    console.warn('[ChecklistEngine] Missing required fields', trigger);
    return;
  }

  try {
    // 1. Safety Check: Does checklist already exist for this parent?
    const existing = await findByQuery('checklist_items', { parentId, checklistType });
    if (existing && existing.length > 0) {
      console.log(`[ChecklistEngine] ${checklistType} Checklist already exists for ${parentId}. Skipping.`);
      return;
    }

    // 2. Fetch Template
    const templates = await getCollection('checklist_templates');
    const normalizedKey = key.trim().toLowerCase();
    
    const template = templates.find((t: ChecklistTemplate) => 
      t.checklistType === checklistType &&
      t.key.trim().toLowerCase() === normalizedKey
    );

    if (!template) {
      console.warn(`[ChecklistEngine] No ${checklistType} template found for key: ${key} (normalized: ${normalizedKey})`);
      return;
    }

    // 3. Generate Items
    const newItems: ChecklistItem[] = template.tasks.map((task: ChecklistTaskTemplate) => {
      const dueDate = new Date(triggerDate);
      dueDate.setDate(dueDate.getDate() + (task.defaultOffsetDays || 0));

      return {
        id: `cli-${checklistType}-${parentId}-${task.id}`,
        parentId,
        checklistType,
        key,
        taskName: task.taskName,
        assignee: task.defaultAssignee === 'Trainer' ? (trainer || 'Unassigned') : task.defaultAssignee,
        dueDate: dueDate.toISOString(),
        status: 'Pending'
      };
    });

    // 4. Persist Items
    for (const item of newItems) {
      await upsertDoc('checklist_items', item.id, item);
    }

    console.log(`[ChecklistEngine] Successfully generated ${newItems.length} ${checklistType} tasks for ${parentId}`);
    return newItems;
  } catch (error) {
    console.error(`[ChecklistEngine] Failed to generate ${checklistType} checklist`, error);
    throw error;
  }
};
