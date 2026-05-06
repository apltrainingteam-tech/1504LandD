import React, { useState, useMemo } from 'react';
import { X, Save, Calendar as CalendarIcon, User } from 'lucide-react';
import { useMasterData } from '../../../core/context/MasterDataContext';
import { PlannedTask, RecurrenceType } from '../../../types/task';
import styles from '../TrackerPage.module.css';

interface Props {
  onClose: () => void;
  onSubmit: (task: Omit<PlannedTask, 'id' | 'status'>) => void;
}

export const PlannedTaskForm: React.FC<Props> = ({ onClose, onSubmit }) => {
  const { taskMaster, trainers } = useMasterData();
  const [formData, setFormData] = useState<Omit<PlannedTask, 'id' | 'status'>>({
    category: '',
    type: '',
    task: '',
    subtask: '',
    assignee: '',
    planDate: new Date().toISOString().split('T')[0],
    dueDate: new Date().toISOString().split('T')[0],
    recurrence: 'None'
  });

  const categories = useMemo(() => Array.from(new Set(taskMaster.map(t => t.category))), [taskMaster]);
  const types = useMemo(() => taskMaster.filter(t => t.category === formData.category).map(t => t.type), [taskMaster, formData.category]);
  const tasks = useMemo(() => taskMaster.filter(t => t.category === formData.category && t.type === formData.type).map(t => t.task).filter(Boolean), [taskMaster, formData.category, formData.type]);
  const subtasks = useMemo(() => taskMaster.filter(t => t.category === formData.category && t.type === formData.type && t.task === formData.task).map(t => t.subtask).filter(Boolean), [taskMaster, formData.category, formData.type, formData.task]);

  const handleSave = () => {
    if (!formData.category || !formData.type || !formData.assignee || !formData.planDate || !formData.dueDate) {
      alert('Please fill all required fields');
      return;
    }
    onSubmit(formData);
  };

  return (
    <div className={styles.modalBackdrop}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Add Planned Task</h3>
          <button className={styles.closeBtn} onClick={onClose}><X size={20} /></button>
        </div>
        
        <div className={styles.modalBody}>
          {/* Row 1: Category | Type */}
          <div className={styles.formGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Category *</label>
              <select 
                className={styles.formInput} 
                value={formData.category} 
                onChange={e => setFormData({ ...formData, category: e.target.value, type: '', task: '', subtask: '' })}
              >
                <option value="">Select Category</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Type *</label>
              <select 
                className={styles.formInput} 
                value={formData.type} 
                onChange={e => setFormData({ ...formData, type: e.target.value, task: '', subtask: '' })}
                disabled={!formData.category}
              >
                <option value="">Select Type</option>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Row 2: Task | Subtask */}
          <div className={styles.formGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Task (Optional)</label>
              <select 
                className={styles.formInput} 
                value={formData.task} 
                onChange={e => setFormData({ ...formData, task: e.target.value, subtask: '' })}
                disabled={tasks.length === 0}
              >
                <option value="">None</option>
                {tasks.map(t => <option key={t} value={t!}>{t}</option>)}
              </select>
            </div>
            
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Subtask (Optional)</label>
              <select 
                className={styles.formInput} 
                value={formData.subtask} 
                onChange={e => setFormData({ ...formData, subtask: e.target.value })}
                disabled={subtasks.length === 0}
              >
                <option value="">None</option>
                {subtasks.map(s => <option key={s} value={s!}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Assignee (Full Width) */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Assignee *</label>
            <div className={styles.inputWithIcon}>
              <User size={16} className={styles.inputIcon} />
              <select 
                className={styles.formInput} 
                value={formData.assignee} 
                onChange={e => setFormData({ ...formData, assignee: e.target.value })}
              >
                <option value="">Select Trainer</option>
                {trainers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
          </div>

          {/* Row 4: Plan Date | Due Date */}
          <div className={styles.formGrid}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Plan Date *</label>
              <div className={styles.inputWithIcon}>
                <CalendarIcon size={16} className={styles.inputIcon} />
                <input 
                  type="date" 
                  className={styles.formInput} 
                  value={formData.planDate} 
                  onChange={e => setFormData({ ...formData, planDate: e.target.value })} 
                />
              </div>
            </div>
            
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Due Date *</label>
              <div className={styles.inputWithIcon}>
                <CalendarIcon size={16} className={styles.inputIcon} />
                <input 
                  type="date" 
                  className={styles.formInput} 
                  value={formData.dueDate} 
                  onChange={e => setFormData({ ...formData, dueDate: e.target.value })} 
                />
              </div>
            </div>
          </div>

          {/* Row 5: Recurrence (Full Width) */}
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Recurrence</label>
            <select 
              className={styles.formInput} 
              value={formData.recurrence} 
              onChange={e => setFormData({ ...formData, recurrence: e.target.value as RecurrenceType })}
            >
              <option value="None">None</option>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.ghostBtn} onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} className="mr-2" /> 
            Create Planned Task
          </button>
        </div>
      </div>
    </div>
  );
};
