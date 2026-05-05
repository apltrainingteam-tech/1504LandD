import React, { useState } from 'react';
import { Plus, Trash2, Save, X, Edit2, Search } from 'lucide-react';
import { useMasterData } from '../../../core/context/MasterDataContext';
import { TaskMasterEntry } from '../../../types/task';
import styles from '../MasterSettings.module.css';

export const TaskMasterSettings: React.FC = () => {
  const { taskMaster, addTaskMasterEntry, updateTaskMasterEntry, deleteTaskMasterEntry } = useMasterData();
  const [showModal, setShowModal] = useState<{ mode: 'add' | 'edit', data?: TaskMasterEntry } | null>(null);
  const [search, setSearch] = useState('');

  const filtered = taskMaster.filter(e => 
    e.category.toLowerCase().includes(search.toLowerCase()) ||
    e.type.toLowerCase().includes(search.toLowerCase()) ||
    e.task?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.taskMaster}>
      <div className={styles.panelHeader}>
        <div className={styles.searchWrapper} style={{ maxWidth: '300px' }}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            className={styles.searchInput} 
            placeholder="Search tasks..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal({ mode: 'add' })}>
          <Plus size={16} /> Add Entry
        </button>
      </div>

      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr className={styles.theadTr}>
              <th className={styles.th}>Category</th>
              <th className={styles.th}>Type</th>
              <th className={styles.th}>Task</th>
              <th className={styles.th}>Subtask</th>
              <th className={styles.thRight}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry => (
              <tr key={entry.id} className={styles.tr}>
                <td className={styles.tdBold}>{entry.category}</td>
                <td className={styles.td}>{entry.type}</td>
                <td className={styles.td}>{entry.task || '—'}</td>
                <td className={styles.td}>{entry.subtask || '—'}</td>
                <td className={styles.tdRight}>
                  <div className={styles.actionGroup}>
                    <button className={`btn btn-secondary ${styles.iconBtn}`} onClick={() => setShowModal({ mode: 'edit', data: entry })}><Edit2 size={14} /></button>
                    <button className={`btn ${styles.iconBtnDanger}`} onClick={() => deleteTaskMasterEntry(entry.id)}><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <TaskMasterModal 
          config={showModal} 
          onClose={() => setShowModal(null)} 
          onSubmit={async (data: any) => {
            if (showModal.mode === 'add') {
              await addTaskMasterEntry({ ...data, id: `tm-${Date.now()}` });
            } else {
              await updateTaskMasterEntry({ ...data, id: showModal.data!.id });
            }
            setShowModal(null);
          }}
        />
      )}
    </div>
  );
};

const TaskMasterModal = ({ config, onClose, onSubmit }: any) => {
  const [formData, setFormData] = useState(config.data || {
    category: '', type: '', task: '', subtask: ''
  });

  return (
    <div className={styles.backdrop}>
      <div className={`glass-panel ${styles.modal}`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{config.mode === 'add' ? 'Add' : 'Edit'} Task Master</h3>
          <button className={styles.closeBtn} onClick={onClose}><X /></button>
        </div>
        <div className={styles.modalBody}>
          <div>
            <label className={styles.fieldLabel}>Category</label>
            <input 
              className="form-input" 
              value={formData.category} 
              onChange={e => setFormData({ ...formData, category: e.target.value })} 
              placeholder="e.g. Updates"
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Type</label>
            <input 
              className="form-input" 
              value={formData.type} 
              onChange={e => setFormData({ ...formData, type: e.target.value })} 
              placeholder="e.g. Quiz"
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Task (Optional)</label>
            <input 
              className="form-input" 
              value={formData.task} 
              onChange={e => setFormData({ ...formData, task: e.target.value })} 
              placeholder="e.g. Level 1"
            />
          </div>
          <div>
            <label className={styles.fieldLabel}>Subtask (Optional)</label>
            <input 
              className="form-input" 
              value={formData.subtask} 
              onChange={e => setFormData({ ...formData, subtask: e.target.value })} 
              placeholder="e.g. Step A"
            />
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSubmit(formData)}><Save size={16} className="mr-2" /> Save</button>
        </div>
      </div>
    </div>
  );
};
