import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, AlertTriangle, Trash2, Calendar as CalIcon, Save, CheckCircle } from 'lucide-react';
import TopRightControls from '../../components/TopRightControls';
import { getFiscalYears, getFiscalYearFromDate, parseFiscalYear, getCurrentFiscalYear } from '../../utils/fiscalYear';
import { usePlanningFlow } from '../../context/PlanningFlowContext';
import { getAvailableTrainers, Trainer } from '../../services/trainerService';
import { Employee } from '../../types/employee';
import { Attendance } from '../../types/attendance';
import { useMasterData } from '../../context/MasterDataContext';
import { getTeamName } from '../../utils/teamIdMapper';
import styles from './TrainingCalendar.module.css';

interface ChecklistItem { name: string; completed: boolean; }
interface TrainingPlan {
  id: string;
  trainingType: string;
  teamId: string;
  team: string; // Keep for display / label
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
  const { trainers: masterTrainers, teams: masterTeams } = useMasterData();
  const [tab, setTab] = useState<TrainingTab>('AP');
  const FY_OPTIONS = getFiscalYears(2015);
  const [selectedFY, setSelectedFY] = useState<string>(FY_OPTIONS[0]);

  const { selectionSession, consumedTeams, consumedTrainers, addConsumed, removeConsumed, saveDraft, resetConsumed, removeDraft } = usePlanningFlow();

  useEffect(() => {
    if (selectionSession) {
      setTab(selectionSession.trainingType as TrainingTab);
      if (selectionSession.fiscalYear !== selectedFY) {
        handleFYChange(selectionSession.fiscalYear);
      }
      // Initialize planning team from session (preserve current selection if still valid)
      if (selectionSession.teamIds?.length > 0) {
        setSelectedPlanningTeamId(prev =>
          selectionSession.teamIds.includes(prev) ? prev : selectionSession.teamIds[0]
        );
      }
    } else {
      setSelectedPlanningTeamId('');
    }
  }, [selectionSession]);

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

  // PLANNING SOURCE OF TRUTH — driven by selectionSession, never by view filters or modal state
  const [selectedPlanningTeamId, setSelectedPlanningTeamId] = useState<string>('');

  // Modal-only form state (no planning decisions made from these)
  const [formTrainer, setFormTrainer] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [overrideTrainer, setOverrideTrainer] = useState(false);

  // Derived: resolved teamId for the current plan action (read-only; never mutated inside modal)
  const resolvedPlanningTeamId = selectedPlanningTeamId || selectionSession?.teamIds?.[0] || '';

  const trainerOptions = useMemo(() => {
    const activeTrainers = masterTrainers.filter(t => t.status === 'Active');
    return getAvailableTrainers(tab, activeTrainers);
  }, [tab, masterTrainers]);

  const hasPlanningContext = Boolean(
    selectionSession &&
    Array.isArray(selectionSession.teamIds) &&
    selectionSession.teamIds.length > 0
  );

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

      if (!hasPlanningContext) {
        alert('Select team(s) from Training Requirement');
        setDragStart(null);
        setDragEnd(null);
        return;
      }

      const start = dragStart <= dragEnd ? dragStart : dragEnd;
      const end = dragStart <= dragEnd ? dragEnd : dragStart;
      setModalStart(start);
      setModalEnd(end);

      // Log for debugging — resolvedPlanningTeamId is the ONLY source used
      console.log('[Calendar] Opening modal. Session teamIds:', selectionSession!.teamIds, '→ resolved teamId:', resolvedPlanningTeamId);

      setFormTrainer('');
      setFormRemarks('');
      setShowCreateModal(true);
    }
    setDragStart(null);
    setDragEnd(null);
  };

  const generateNominationDraft = async ({
    teamId, trainingId, trainingType, trainer, startDate, endDate
  }: { teamId: string; trainingId: string; trainingType: string; trainer: string; startDate: string; endDate: string }) => {
    if (!teamId) throw new Error('Assertion failed: teamId must be defined for draft generation');
    console.log('[Draft] Generating nomination. teamId:', teamId, 'trainingType:', trainingType);

    const teamObj = masterTeams.find(t => t.id === teamId);
    const teamLabel = teamObj ? teamObj.teamName : teamId;

    const eligible = employees.filter(e => e.teamId === teamId);
    const top40 = eligible.slice(0, 40).map(e => String(e.employeeId));

    saveDraft({
      id: trainingId,
      teamId,
      trainingId,
      trainingType,
      team: teamLabel,
      trainer,
      startDate,
      endDate,
      candidates: top40,
      status: 'DRAFT'
    });
    console.log('[Draft] Saved. teamId:', teamId, 'candidates:', top40.length);
  };

  const handleCreatePlan = async () => {
    // STRICT: team always comes from selectedPlanningTeamId — never from modal state
    const teamId = resolvedPlanningTeamId;
    if (!teamId) {
      console.error('[Calendar] BLOCKED: No planning teamId resolved. Session:', selectionSession?.teamIds);
      return alert('No planning team selected. Please choose a team from Training Requirement.');
    }
    if (!formTrainer) return alert('Trainer is required.');

    const teamObj = masterTeams.find(t => t.id === teamId);
    const teamLabel = teamObj ? teamObj.teamName : teamId;

    const newId = Math.random().toString(36).substr(2, 9);
    const newPlan: TrainingPlan = {
      id: newId,
      trainingType: tab,
      teamId,
      team: teamLabel,
      trainer: formTrainer,
      startDate: modalStart,
      endDate: modalEnd,
      remarks: formRemarks,
      checklist: (CHECKLIST_RULES[tab] || []).map(name => ({ name, completed: false }))
    };

    setPlans([...plans, newPlan]);
    addConsumed(teamLabel, formTrainer);

    // Always pass teamId explicitly — never read from modal or view filter state
    await generateNominationDraft({ teamId, trainingId: newId, trainingType: tab, trainer: formTrainer, startDate: modalStart, endDate: modalEnd });

    setShowCreateModal(false);
  };

  const handleDeletePlan = (id: string) => {
    if (!window.confirm("Delete this training plan?")) return;
    const plan = plans.find(p => p.id === id);
    if (plan) {
      removeConsumed(plan.team, plan.trainer);
      removeDraft(plan.id);
    }
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
    if (filterTeam && p.teamId !== filterTeam) return false;
    if (filterTrainer && p.trainer !== filterTrainer) return false;
    if (getFiscalYearFromDate(p.startDate) !== selectedFY) return false;
    return true;
  });

  const getPlansForDate = (dateStr: string) => {
    return filteredPlans.filter(p => dateStr >= p.startDate && dateStr <= p.endDate);
  };

  return (
    <div className={styles.page} onMouseUp={handleMouseUp} onMouseLeave={() => setIsDragging(false)}>

      {/* HEADER */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.pageTitle}>Training Calendar</h1>
          <p className={styles.pageSubtitle}>Plan and monitor training activities</p>
        </div>
        <TopRightControls
          fiscalOptions={FY_OPTIONS}
          selectedFY={selectedFY}
          onChangeFY={handleFYChange}
          activeFilterCount={0}
        />
      </div>

      {/* TABS */}
      <div className={`gap-tabs ${styles.tabBar}`}>
        <div>
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
      </div>

      {hasPlanningContext && (
        <div className={styles.planningBanner}>
          <div className={styles.planningBannerLabel}>
            Planning for:
            {selectionSession!.teamIds.length > 1 ? (
              // Multi-team: selectedPlanningTeamId is the ONLY source of truth for which team is active
              <select
                className={`form-input ${styles.planningTeamSelect}`}
                value={selectedPlanningTeamId}
                onChange={e => setSelectedPlanningTeamId(e.target.value)}
                title="Select Planning Team"
                aria-label="Select Planning Team"
              >
                {selectionSession!.teamIds.map(id => {
                  const t = masterTeams.find(mt => mt.id === id);
                  return <option key={id} value={id}>{t ? t.teamName : id}</option>;
                })}
              </select>
            ) : (
              <span>{masterTeams.find(mt => mt.id === selectionSession!.teamIds[0])?.teamName || selectionSession!.teams[0]}</span>
            )}
          </div>
          <button className={`btn btn-secondary ${styles.resetBtn}`} onClick={() => {
            if (window.confirm('Reset all blocked Teams and Trainers?')) resetConsumed();
          }}>
            Reset Selection
          </button>
        </div>
      )}

      {/* FILTER BAR & MONTH CONTROLS */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>View:</span>
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className={`form-input ${styles.filterSelect}`} title="Filter by Team" aria-label="Filter by Team">
          <option value="">All Teams</option>
          {masterTeams.filter(t => t.status === 'Active').sort((a, b) => a.teamName.localeCompare(b.teamName)).map(t => (
            <option key={t.id} value={t.id}>{t.teamName}</option>
          ))}
        </select>

        <select value={filterTrainer} onChange={e => setFilterTrainer(e.target.value)} className={`form-input ${styles.filterSelect}`} title="Filter by Trainer" aria-label="Filter by Trainer">
          <option value="">All Trainers</option>
          {masterTrainers.filter(t => t.status === 'Active').sort((a, b) => a.trainerName.localeCompare(b.trainerName)).map(t => (
            <option key={t.id} value={t.id}>{t.trainerName} ({t.category})</option>
          ))}
        </select>

        <div className={styles.filterSpacer}></div>

        <div className={styles.monthNav}>
          <button onClick={() => changeMonth(-1)} title="Previous Month" aria-label="Previous Month" className={styles.monthNavBtn}><ChevronLeft size={18} /></button>
          <span className={styles.monthLabel}>
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </span>
          <button onClick={() => changeMonth(1)} title="Next Month" aria-label="Next Month" className={styles.monthNavBtn}><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* CALENDAR GRID */}
      <div className={`glass-panel ${styles.calendarPanel}`}>
        <div className={styles.dayHeaders}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className={styles.dayHeader}>{day}</div>
          ))}
        </div>

        <div className={styles.calendarGrid}>
          {gridCells.map((date, idx) => {
            if (!date) return <div key={idx} className={styles.emptyCell} />;

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
                className={`${styles.dayCell} ${isSelected ? styles.dayCellSelected : styles.dayCellDefault} ${isToday ? styles.dayCellToday : ''}`}
              >
                <div className={`${styles.dayNumber} ${isToday ? styles.dayNumberToday : styles.dayNumberDefault}`}>
                  {date.getDate()}
                </div>

                <div className={styles.planList}>
                  {visiblePlans.map(p => {
                    const status = getStatus(p);
                    const color = status === 'Completed' ? 'var(--success)' : 'var(--text-secondary)';
                    const displayTeam = getTeamName(p.teamId, masterTeams);
                    const trainerObj = masterTrainers.find(mt => mt.id === p.trainer);
                    const displayTrainer = trainerObj ? trainerObj.trainerName : p.trainer;

                    return (
                      <div
                        key={p.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedPlanId(p.id); }}
                        className={`${styles.planChip} ${status === 'Completed' ? styles.planChipCompleted : styles.planChipPlanned}`}
                      >
                        <div className={styles.planChipText}>
                          <span className={styles.planType}>{p.trainingType}</span>
                          <span className={styles.planTeam}>{displayTeam}</span>
                          <span className={styles.planTrainer}>{displayTrainer}</span>
                        </div>
                        <div className={`${styles.planDot} ${status === 'Completed' ? styles.planDotCompleted : styles.planDotPlanned}`}></div>
                      </div>
                    );
                  })}

                  {extraCount > 0 && (
                    <div className={styles.extraCount}>
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
        <div className={styles.modalBackdrop}>
          <div className={`glass-panel ${styles.createModal}`}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}><CalIcon size={18} /> Create Plan ({tab})</h3>
              <button className={`btn ${styles.modalCloseBtn}`} onClick={() => setShowCreateModal(false)} title="Close Modal" aria-label="Close Modal"><X size={18} /></button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.dateDisplay}>
                <span className={styles.dateBold}>Date:</span> {modalStart} {modalStart !== modalEnd && ` to ${modalEnd}`}
              </div>

              <div>
                <label className={styles.formLabel}>Team</label>
                {/* Read-only: value always comes from selectedPlanningTeamId, never from modal input */}
                <div className={styles.teamDisplay}>
                  {masterTeams.find(t => t.id === resolvedPlanningTeamId)?.teamName || resolvedPlanningTeamId || '—'}
                </div>
              </div>

              <div>
                <div className={styles.trainerHeader}>
                  <label className={styles.trainerLabel}>Trainer <span className={styles.requiredMark}>*</span></label>
                  <label className={styles.overrideLabel}>
                    <input type="checkbox" checked={overrideTrainer} onChange={e => setOverrideTrainer(e.target.checked)} title="Show Used Trainers" aria-label="Show Used Trainers" />
                    Show Used Trainers
                  </label>
                </div>
                <select value={formTrainer} onChange={e => setFormTrainer(e.target.value)} className="form-input" title="Select Trainer" aria-label="Select Trainer">
                  <option value="">Select Trainer...</option>
                  {trainerOptions.map(t => {
                    const isUsed = !overrideTrainer && consumedTrainers.has(t.id);
                    return (
                      <option 
                        key={t.id} 
                        value={t.id} 
                        disabled={isUsed} 
                        title={isUsed ? 'Already used in this planning session' : ''} 
                        className={isUsed ? styles.trainerOptionUsed : ''}
                      >
                        {t.trainerName} ({t.category}) {isUsed ? '(Used)' : ''}
                      </option>
                    );
                  })}
                </select>
                {hasConflict(formTrainer, modalStart, modalEnd) && (
                  <div className={styles.conflictWarning}>
                    <AlertTriangle size={12} /> Trainer is already assigned to another training on overlapping dates
                  </div>
                )}
              </div>

              <div>
                <label className={styles.formLabel}>Remarks</label>
                <textarea
                  value={formRemarks}
                  onChange={e => setFormRemarks(e.target.value)}
                  className={`form-input ${styles.remarksTextarea}`}
                  placeholder="Optional details..."
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreatePlan}><Save size={16} /> Save Plan</button>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT SLIDE PANEL */}
      {selectedPlan && (
        <div className={styles.detailPanel}>
          <div className={styles.detailPanelHeader}>
            <h2 className={styles.detailTitle}>
              Training Details
              {getStatus(selectedPlan) === 'Completed' && <span className={`badge badge-success ${styles.completedBadge}`}>Completed</span>}
              {getStatus(selectedPlan) === 'Planned' && <span className={`badge ${styles.badgePlanned}`}>Planned</span>}
            </h2>
            <button className={`btn ${styles.detailCloseBtn}`} onClick={() => setSelectedPlanId(null)} title="Close Details" aria-label="Close Details"><X size={20} /></button>
          </div>

          <div className={styles.detailBody}>

            {/* Context Details */}
            <div className={styles.detailGrid}>
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Training Type</div>
                <div className={styles.detailFieldValue}>{selectedPlan.trainingType}</div>
              </div>
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Team</div>
                <div className={styles.detailFieldValue}>{selectedPlan.team}</div>
              </div>
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Trainer</div>
                <div className={styles.detailFieldValue}>{selectedPlan.trainer}</div>
              </div>
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Dates</div>
                <div className={styles.detailFieldValue}>{selectedPlan.startDate} {selectedPlan.startDate !== selectedPlan.endDate && ` to ${selectedPlan.endDate}`}</div>
              </div>
              {selectedPlan.remarks && (
                <div className={styles.detailField}>
                  <div className={styles.detailFieldLabel}>Remarks</div>
                  <div className={styles.remarksBox}>{selectedPlan.remarks}</div>
                </div>
              )}
            </div>

            {hasConflict(selectedPlan.trainer, selectedPlan.startDate, selectedPlan.endDate, selectedPlan.id) && (
              <div className={styles.conflictBanner}>
                <AlertTriangle size={16} /> Trainer is assigned to another overlapping training.
              </div>
            )}

            {/* Checklist */}
            <div className={styles.checklistSection}>
              <h3 className={styles.checklistTitle}>
                <CheckCircle size={18} color="var(--accent-primary)" /> Execution Checklist
              </h3>
              <div className={styles.checklistItems}>
                {selectedPlan.checklist.length === 0 ? (
                  <div className={styles.checklistEmpty}>No checklist required for this type.</div>
                ) : (
                  selectedPlan.checklist.map((item, idx) => (
                    <div
                      key={item.name}
                      onClick={() => toggleChecklistItem(idx)}
                      className={styles.checklistItem}
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        readOnly
                        title="Checklist Item"
                        aria-label={`Checklist item: ${item.name}`}
                        className={styles.checklistCheckbox}
                      />
                      <span className={`${styles.checklistLabel} ${item.completed ? styles.checklistLabelDone : styles.checklistLabelPending}`}>
                        {item.name}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          <div className={styles.detailFooter}>
            <button
              className={`btn ${styles.deleteBtn}`}
              onClick={() => handleDeletePlan(selectedPlan.id)}
            >
              <Trash2 size={16} /> Delete Plan
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
