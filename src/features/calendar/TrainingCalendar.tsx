import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, AlertTriangle, Trash2, Calendar as CalIcon, Save } from 'lucide-react';
import TopRightControls from '../../components/TopRightControls';
import { getFiscalYears, getFiscalYearFromDate, parseFiscalYear, getCurrentFiscalYear } from '../../utils/fiscalYear';
import { Employee } from '../../types/employee';
import { Attendance } from '../../types/attendance';

interface ChecklistItem { name: string; completed: boolean; }
interface TrainingPlan {
  id: string;
  trainingType: string;
  team: string;
  trainer: string;
  startDate: string;
  endDate: string;
  remarks?: string;
  checklist: ChecklistItem[];
}

const CHECKLIST_RULES: Record<string, string[]> = {
  IP: ["Database", "Bill"],
  Capsule: ["Database"],
  "Pre-AP": ["Database"],
  AP: ["Booking", "Notice", "Database", "Bill"],
  MIP: ["Booking", "Notice", "Database", "Bill"],
  Refresher: ["Booking", "Notice", "Database", "Bill"]
};

type TrainingTab = 'IP' | 'AP' | 'MIP' | 'Capsule' | 'Refresher' | 'Pre-AP';

const formatDateStr = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getStatus = (plan: TrainingPlan) => {
  if (plan.checklist.length === 0) return 'Planned';
  return plan.checklist.every(c => c.completed) ? 'Completed' : 'Planned';
};

export const TrainingCalendar = ({ employees, attendance }: { employees: Employee[], attendance: Attendance[] }) => {
  const [tab, setTab] = useState<TrainingTab>('AP');
  const FY_OPTIONS = getFiscalYears(2015);
  const [selectedFY, setSelectedFY] = useState<string>(FY_OPTIONS[0]);

  const handleFYChange = (newFY: string) => {
    setSelectedFY(newFY);
    const fyStartYear = parseFiscalYear(newFY);
    if (fyStartYear) {
      const currentFY = getCurrentFiscalYear();
      if (fyStartYear === currentFY) {
        setCurrentDate(new Date()); // snap to current time if looking at current FY
      } else {
        setCurrentDate(new Date(fyStartYear, 3, 1)); // 3 = April
      }
    }
    setSelectedPlanId(null);
  };

  // Filters
  const [filterTeam, setFilterTeam] = useState('');
  const [filterTrainer, setFilterTrainer] = useState('');

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());

  // Data Store (In-Memory for now as per requirements logic)
  const [plans, setPlans] = useState<TrainingPlan[]>([]);

  // Drag selection state
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Modals / Panels
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalStart, setModalStart] = useState('');
  const [modalEnd, setModalEnd] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Form State
  const [formTeam, setFormTeam] = useState('');
  const [formTrainer, setFormTrainer] = useState('');
  const [formRemarks, setFormRemarks] = useState('');

  const allTeams = useMemo(() => [...new Set(employees.map(e => e.team).filter(Boolean))].sort(), [employees]);
  const allTrainers = useMemo(() => [...new Set(attendance.map(a => a.trainerId).filter(Boolean))].sort(), [attendance]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const gridCells: (Date | null)[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) gridCells.push(null);
  for (let i = 1; i <= daysInMonth; i++) gridCells.push(new Date(year, month, i));

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(year, month + offset, 1));
  };

  const hasConflict = (trainer: string, start: string, end: string, excludeId?: string) => {
    if (!trainer) return false;
    return plans.some(p => {
      if (p.id === excludeId) return false;
      if (p.trainer !== trainer) return false;
      return (p.startDate <= end && p.endDate >= start);
    });
  };

  // Interactions
  const handleMouseDown = (dateStr: string) => {
    setIsDragging(true);
    setDragStart(dateStr);
    setDragEnd(dateStr);
  };

  const handleMouseEnter = (dateStr: string) => {
    if (isDragging) setDragEnd(dateStr);
  };

  const handleMouseUp = () => {
    if (isDragging && dragStart && dragEnd) {
      setIsDragging(false);
      const start = dragStart <= dragEnd ? dragStart : dragEnd;
      const end = dragStart <= dragEnd ? dragEnd : dragStart;
      setModalStart(start);
      setModalEnd(end);
      setFormTeam('');
      setFormTrainer('');
      setFormRemarks('');
      setShowCreateModal(true);
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const handleCreatePlan = () => {
    if (!formTeam || !formTrainer) return alert('Team and Trainer are required.');
    
    const newPlan: TrainingPlan = {
      id: Math.random().toString(36).substr(2, 9),
      trainingType: tab,
      team: formTeam,
      trainer: formTrainer,
      startDate: modalStart,
      endDate: modalEnd,
      remarks: formRemarks,
      checklist: (CHECKLIST_RULES[tab] || []).map(name => ({ name, completed: false }))
    };

    setPlans([...plans, newPlan]);
    setShowCreateModal(false);
  };

  const handleDeletePlan = (id: string) => {
    if (!window.confirm("Delete this training plan?")) return;
    setPlans(plans.filter(p => p.id !== id));
    setSelectedPlanId(null);
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId) || null;

  const toggleChecklistItem = (itemIndex: number) => {
    if (!selectedPlan) return;
    const updatedPlans = plans.map(p => {
      if (p.id === selectedPlan.id) {
        const newChecklist = [...p.checklist];
        newChecklist[itemIndex].completed = !newChecklist[itemIndex].completed;
        return { ...p, checklist: newChecklist };
      }
      return p;
    });
    setPlans(updatedPlans);
  };

  // Render Helpers
  const isDateInDragRange = (dateStr: string) => {
    if (!dragStart || !dragEnd) return false;
    const s = dragStart <= dragEnd ? dragStart : dragEnd;
    const e = dragStart <= dragEnd ? dragEnd : dragStart;
    return dateStr >= s && dateStr <= e;
  };

  const filteredPlans = plans.filter(p => {
    if (p.trainingType !== tab) return false;
    if (filterTeam && p.team !== filterTeam) return false;
    if (filterTrainer && p.trainer !== filterTrainer) return false;
    if (getFiscalYearFromDate(p.startDate) !== selectedFY) return false;
    return true;
  });

  const getPlansForDate = (dateStr: string) => {
    return filteredPlans.filter(p => dateStr >= p.startDate && dateStr <= p.endDate);
  };

  return (
    <div style={{ padding: '24px', userSelect: 'none' }} onMouseUp={handleMouseUp} onMouseLeave={() => setIsDragging(false)}>
      
      {/* HEADER */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Training Calendar</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0', fontSize: '13px' }}>Plan and monitor training activities</p>
        </div>
        <TopRightControls
          fiscalOptions={FY_OPTIONS}
          selectedFY={selectedFY}
          onChangeFY={handleFYChange}
          activeFilterCount={0}
        />
      </div>

      {/* TABS */}
      <div className="gap-tabs" style={{ marginBottom: '16px' }}>
        {(['IP', 'AP', 'MIP', 'Capsule', 'Refresher', 'Pre-AP'] as TrainingTab[]).map(t => (
          <button
            key={t}
            className={`gap-tab ${tab === t ? 'gap-tab-active' : ''}`}
            onClick={() => { setTab(t); setSelectedPlanId(null); }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* FILTER BAR & MONTH CONTROLS */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className="form-input" style={{ width: '200px' }}>
          <option value="">All Teams</option>
          {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        
        <select value={filterTrainer} onChange={e => setFilterTrainer(e.target.value)} className="form-input" style={{ width: '200px' }}>
          <option value="">All Trainers</option>
          {allTrainers.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div style={{ flex: 1 }}></div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-card)', padding: '6px 16px', borderRadius: '24px', border: '1px solid var(--border-color)' }}>
          <button onClick={() => changeMonth(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><ChevronLeft size={18}/></button>
          <span style={{ fontWeight: 600, fontSize: '15px', minWidth: '100px', textAlign: 'center' }}>
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => changeMonth(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}><ChevronRight size={18}/></button>
        </div>
      </div>

      {/* CALENDAR GRID */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--border-color)', gap: '1px', borderBottom: '1px solid var(--border-color)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{ padding: '12px', background: 'var(--bg-card)', textAlign: 'center', fontWeight: 'bold', fontSize: '13px', color: 'var(--text-secondary)' }}>
              {day}
            </div>
          ))}
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--border-color)', gap: '1px' }}>
          {gridCells.map((date, idx) => {
            if (!date) return <div key={idx} style={{ background: 'var(--bg-card)', minHeight: '120px', opacity: 0.3 }} />;
            
            const dateStr = formatDateStr(date);
            const isSelected = isDateInDragRange(dateStr);
            const dayPlans = getPlansForDate(dateStr);
            const isToday = formatDateStr(new Date()) === dateStr;

            const visiblePlans = dayPlans.slice(0, 3);
            const extraCount = dayPlans.length - 3;

            return (
              <div 
                key={dateStr}
                onMouseDown={() => handleMouseDown(dateStr)}
                onMouseEnter={() => handleMouseEnter(dateStr)}
                style={{ 
                  background: isSelected ? 'var(--accent-secondary)' : 'var(--bg-card)',
                  minHeight: '120px',
                  padding: '8px',
                  cursor: 'pointer',
                  border: isToday ? '1px solid var(--accent-primary)' : 'none',
                  transition: 'background 0.1s'
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)', marginBottom: '8px', textAlign: 'right' }}>
                  {date.getDate()}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {visiblePlans.map(p => {
                    const status = getStatus(p);
                    const color = status === 'Completed' ? 'var(--success)' : 'var(--text-secondary)';
                    
                    return (
                      <div 
                        key={p.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedPlanId(p.id); }}
                        style={{ 
                          fontSize: '11px',
                          padding: '4px 6px',
                          background: 'rgba(0,0,0,0.03)',
                          borderRadius: '4px',
                          borderLeft: `3px solid ${color}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}
                      >
                        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          <span style={{ fontWeight: 700, marginRight: '4px' }}>{p.trainingType}</span>
                          <span style={{ fontWeight: 500, marginRight: '4px' }}>{p.team}</span>
                          <span style={{ opacity: 0.7 }}>{p.trainer}</span>
                        </div>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }}></div>
                      </div>
                    )
                  })}

                  {extraCount > 0 && (
                    <div style={{ fontSize: '11px', color: 'var(--accent-primary)', fontWeight: 600, padding: '2px 4px', textAlign: 'center' }}>
                      +{extraCount} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="glass-panel" style={{ width: '450px', padding: '0', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}><CalIcon size={18} /> Create Plan ({tab})</h3>
              <button className="btn" onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none' }}><X size={18} /></button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '8px', fontSize: '13px' }}>
                <span style={{ fontWeight: 600 }}>Date:</span> {modalStart} {modalStart !== modalEnd && ` to ${modalEnd}`}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Team <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select value={formTeam} onChange={e => setFormTeam(e.target.value)} className="form-input">
                  <option value="">Select Team...</option>
                  {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Trainer <span style={{ color: 'var(--danger)' }}>*</span></label>
                <select value={formTrainer} onChange={e => setFormTrainer(e.target.value)} className="form-input">
                  <option value="">Select Trainer...</option>
                  {allTrainers.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {hasConflict(formTrainer, modalStart, modalEnd) && (
                  <div style={{ color: 'var(--warning)', fontSize: '11px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> Trainer is already assigned to another training on overlapping dates
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Remarks</label>
                <textarea 
                  value={formRemarks} 
                  onChange={e => setFormRemarks(e.target.value)} 
                  className="form-input" 
                  placeholder="Optional details..."
                  style={{ minHeight: '60px', resize: 'vertical' }}
                />
              </div>
            </div>

            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreatePlan}><Save size={16} /> Save Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT SLIDE PANEL */}
      {selectedPlan && (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '400px', background: 'var(--bg-card)', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', zIndex: 1000, display: 'flex', flexDirection: 'column', transform: 'translateX(0)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              Training Details
              {getStatus(selectedPlan) === 'Completed' && <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 6px' }}>Completed</span>}
              {getStatus(selectedPlan) === 'Planned' && <span className="badge" style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)' }}>Planned</span>}
            </h2>
            <button className="btn" onClick={() => setSelectedPlanId(null)} style={{ background: 'none', border: 'none' }}><X size={20} /></button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            {/* Context Details */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Training Type</div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{selectedPlan.trainingType}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Team</div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{selectedPlan.team}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Trainer</div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{selectedPlan.trainer}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Dates</div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{selectedPlan.startDate} {selectedPlan.startDate !== selectedPlan.endDate && ` to ${selectedPlan.endDate}`}</div>
              </div>
              {selectedPlan.remarks && (
                <div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Remarks</div>
                  <div style={{ fontSize: '14px', fontStyle: 'italic', background: 'rgba(0,0,0,0.02)', padding: '12px', borderRadius: '8px' }}>{selectedPlan.remarks}</div>
                </div>
              )}
            </div>

            {hasConflict(selectedPlan.trainer, selectedPlan.startDate, selectedPlan.endDate, selectedPlan.id) && (
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', padding: '12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} /> Trainer is assigned to another overlapping training.
              </div>
            )}

            {/* Checklist */}
            <div>
              <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CheckCircle size={18} color="var(--accent-primary)" /> Execution Checklist
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {selectedPlan.checklist.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No checklist required for this type.</div>
                ) : (
                  selectedPlan.checklist.map((item, idx) => (
                    <div 
                      key={item.name} 
                      onClick={() => toggleChecklistItem(idx)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', 
                        background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--border-color)',
                        cursor: 'pointer', transition: 'all 0.1s' 
                      }}
                    >
                      <input 
                        type="checkbox" 
                        checked={item.completed} 
                        readOnly 
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '14px', fontWeight: item.completed ? 500 : 600, opacity: item.completed ? 0.6 : 1, textDecoration: item.completed ? 'line-through' : 'none' }}>
                        {item.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          <div style={{ padding: '24px', borderTop: '1px solid var(--border-color)' }}>
            <button 
              className="btn" 
              onClick={() => handleDeletePlan(selectedPlan.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', border: 'none' }}
            >
              <Trash2 size={16} /> Delete Plan
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
