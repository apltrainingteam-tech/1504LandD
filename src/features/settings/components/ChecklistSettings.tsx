import React, { useState } from 'react';
import { Plus, Trash2, Save, Layers, User, Calendar, ClipboardList, Target } from 'lucide-react';
import { useMasterData } from '../../../core/context/MasterDataContext';
import { ChecklistTemplate, ChecklistTaskTemplate, ChecklistType } from '../../../types/checklist';
import styles from '../MasterSettings.module.css';

export const ChecklistSettings: React.FC = () => {
  const { checklistTemplates, addChecklistTemplate, updateChecklistTemplate, trainers } = useMasterData();
  const [editingTemplate, setEditingTemplate] = useState<ChecklistTemplate | null>(null);
  const [activeType, setActiveType] = useState<ChecklistType>('Training');

  const trainingTypes = ['AP', 'IP', 'MIP', 'Refresher', 'Capsule', 'PreAP', 'GTG', 'HO', 'RTM'];
  const productTypes = ['New Product']; // Can be extended

  const handleAddTemplate = (type: string) => {
    const newTemplate: ChecklistTemplate = {
      id: `ct-${activeType}-${Date.now()}`,
      checklistType: activeType,
      key: type,
      tasks: []
    };
    setEditingTemplate(newTemplate);
  };

  const handleAddTask = () => {
    if (!editingTemplate) return;
    const newTask: ChecklistTaskTemplate = {
      id: `task-${Date.now()}`,
      taskName: '',
      defaultAssignee: 'Trainer',
      defaultOffsetDays: 0
    };
    setEditingTemplate({
      ...editingTemplate,
      tasks: [...editingTemplate.tasks, newTask]
    });
  };

  const handleUpdateTask = (taskId: string, updates: Partial<ChecklistTaskTemplate>) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      tasks: editingTemplate.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
    });
  };

  const handleRemoveTask = (taskId: string) => {
    if (!editingTemplate) return;
    setEditingTemplate({
      ...editingTemplate,
      tasks: editingTemplate.tasks.filter(t => t.id !== taskId)
    });
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    const existing = checklistTemplates.find(t => t.id === editingTemplate.id);
    if (existing) {
      updateChecklistTemplate(editingTemplate);
    } else {
      addChecklistTemplate(editingTemplate);
    }
    setEditingTemplate(null);
  };

  const currentKeys = activeType === 'Training' ? trainingTypes : productTypes;

  return (
    <div className={styles.checklistSettings}>
      {/* Type Toggle */}
      <div className="flex gap-4 mb-24">
        <button 
          className={`btn ${activeType === 'Training' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveType('Training'); setEditingTemplate(null); }}
        >
          <ClipboardList size={18} className="mr-2" /> Training Checklist
        </button>
        <button 
          className={`btn ${activeType === 'NewProduct' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveType('NewProduct'); setEditingTemplate(null); }}
        >
          <Target size={18} className="mr-2" /> New Product Checklist
        </button>
      </div>

      <div className={styles.panelHeader}>
        <h3 className={styles.panelHeaderTitle}>{activeType === 'Training' ? 'Training' : 'New Product'} Templates</h3>
        <div className="flex gap-2">
          {currentKeys.map(key => (
            <button 
              key={key}
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const existing = checklistTemplates.find(t => t.key === key && t.checklistType === activeType);
                if (existing) setEditingTemplate(existing);
                else handleAddTemplate(key);
              }}
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {editingTemplate ? (
        <div className={`glass-panel mt-4 ${styles.templateEditor}`}>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-bold">Editing Template: {editingTemplate.key}</h4>
            <div className="flex gap-2">
              <button className="btn btn-secondary" onClick={() => setEditingTemplate(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}><Save size={16} className="mr-1" /> Save Template</button>
            </div>
          </div>

          <table className={styles.table}>
            <thead>
              <tr className={styles.theadTr}>
                <th className={styles.th}>Task Name</th>
                <th className={styles.th}>Default Assignee</th>
                <th className={styles.th}>Due Offset (Days)</th>
                <th className={styles.thRight}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {editingTemplate.tasks.map(task => (
                <tr key={task.id} className={styles.tr}>
                  <td className={styles.td}>
                    <input 
                      className="form-input" 
                      value={task.taskName} 
                      onChange={e => handleUpdateTask(task.id, { taskName: e.target.value })}
                      placeholder="e.g. Nomination"
                    />
                  </td>
                  <td className={styles.td}>
                    <select 
                      className="form-input"
                      value={task.defaultAssignee}
                      onChange={e => handleUpdateTask(task.id, { defaultAssignee: e.target.value })}
                    >
                      {activeType === 'NewProduct' ? (
                        <>
                          <option value="">Select Trainer</option>
                          {trainers.filter(t => t.status === 'Active').map(t => (
                            <option key={t.id} value={t.name}>{t.name}</option>
                          ))}
                        </>
                      ) : (
                        <>
                          <option value="Trainer">Trainer</option>
                          <option value="Admin">Admin</option>
                          <option value="HR">HR</option>
                          <option value="Gyanmitra">Gyanmitra</option>
                        </>
                      )}
                    </select>
                  </td>
                  <td className={styles.td}>
                    <input 
                      type="number"
                      className="form-input"
                      value={task.defaultOffsetDays}
                      onChange={e => handleUpdateTask(task.id, { defaultOffsetDays: parseInt(e.target.value) || 0 })}
                    />
                  </td>
                  <td className={styles.tdRight}>
                    <button className="btn-icon text-danger" onClick={() => handleRemoveTask(task.id)}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-secondary mt-4 w-full" onClick={handleAddTask}>
            <Plus size={16} className="mr-1" /> Add Task
          </button>
        </div>
      ) : (
        <div className="p-48 text-center text-muted">
          <Layers size={48} className="mx-auto mb-12 opacity-20" />
          <p>Select a {activeType === 'Training' ? 'Training Type' : 'Product Type'} above to configure its template.</p>
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {checklistTemplates
          .filter(t => t.checklistType === activeType)
          .map(t => (
          <div key={t.id} className="glass-panel p-16 cursor-pointer hover:border-primary transition-all" onClick={() => setEditingTemplate(t)}>
            <div className="flex justify-between items-center mb-8">
              <span className="badge badge-primary">{t.key}</span>
              <span className="text-xs text-muted">{t.tasks.length} tasks</span>
            </div>
            <div className="text-sm text-muted">
              {t.tasks.slice(0, 3).map(task => (
                <div key={task.id} className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded-full border border-current opacity-20" />
                  <span>{task.taskName}</span>
                </div>
              ))}
              {t.tasks.length > 3 && <div>+ {t.tasks.length - 3} more...</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
