import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, AlertTriangle, Trash2, Calendar as CalIcon, Save, CheckCircle } from 'lucide-react';
import TrainerAvatar from '../../shared/components/ui/TrainerAvatar';
import { FlowStepper } from '../../shared/components/ui/FlowStepper';
import { getFiscalYearFromDate, parseFiscalYear, getCurrentFiscalYear } from '../../core/utils/fiscalYear';
import { usePlanningFlow } from '../../core/context/PlanningFlowContext';
import { getAvailableTrainers, Trainer } from '../../core/engines/trainerEngine';
import { Employee } from '../../types/employee';
import { Attendance, NotificationRecord, NominationDraft, TrainingPlanStatus } from '../../types/attendance';
import { useMasterData } from '../../core/context/MasterDataContext';
import { getTeamName } from '../../core/utils/teamIdMapper';
import { normalizeString, match, safeSort } from '../../core/engines/normalizationEngine';
import API_BASE from '../../config/api';
import styles from './TrainingCalendar.module.css';

export interface TeamBatchStatus {
  trainingId: string;
  teamId: string;
  teamName: string;
  status: 'OPEN';
}

interface ChecklistItem { name: string; completed: boolean; }
interface TrainingPlan {
  id: string;
  trainingType: string;
  status: TrainingPlanStatus;
  teams: TeamBatchStatus[];
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
  if (plan.status === 'Cancelled') return 'Cancelled';
  if (plan.status === 'Completed') return 'Completed';
  if (plan.status === 'Notified') return 'Notified';
  if (plan.checklist.length === 0) return 'Planned';
  return plan.checklist.every(c => c.completed) ? 'Completed' : 'Planned';
};


import { useCalendarData } from '../../shared/hooks/useCalendarData';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';

export const TrainingCalendar = ({ employees, attendance }: { employees: Employee[], attendance: Attendance[] }) => {
  const { filters: globalFilters, setFilters } = useGlobalFilters();
  const { trainers: masterTrainers, teams: masterTeams, refreshTransactional } = useMasterData();
  const { plans } = useCalendarData();

  const resolveTrainerAvatar = (trainerId: string) => {
    const trainer = masterTrainers.find(t => t.id === trainerId);
    if (!trainer || !trainer.avatarUrl) return null;
    if (trainer.avatarUrl.startsWith('http')) return trainer.avatarUrl;
    // Resolve relative path using API_BASE
    const base = API_BASE.replace('/api', '');
    return `${base}${trainer.avatarUrl}`;
  };

  const [tabState, setTabState] = useState<TrainingTab>('AP');
  const tab = globalFilters.trainingType !== 'ALL' ? globalFilters.trainingType as TrainingTab : tabState;

  const FY_OPTIONS: string[] = []; // kept for type safety; FY now driven by GlobalFilterContext
  const selectedFY = globalFilters.fiscalYear;

  const {
    selectionSession, consumedTeams, consumedTrainers, addConsumed,
    removeConsumed, saveDraft, updateDraft, removeDraft,
    loadNotificationHistory, notificationRecords, drafts, cancelDraft
  } = usePlanningFlow();

  useEffect(() => {
    if (selectionSession) {
      setTabState(selectionSession.trainingType as TrainingTab);
      // FY is now globally controlled
      if (selectedPlanningTeamIds.length === 0) {
        setSelectedPlanningTeamIds(selectionSession.teamIds || []);
      }
    } else {
      setSelectedPlanningTeamIds([]);
    }
  }, [selectionSession]);

  const togglePlanningTeam = (teamId: string) => {
    setSelectedPlanningTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const handleFYChange = (newFY: string) => {
    setFilters({ fiscalYear: newFY });
    setSelectedPlanId(null);
  };

  // Calendar State (Navigation)
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const fyStartYear = parseFiscalYear(selectedFY);
    if (fyStartYear) {
      const currentFY = getCurrentFiscalYear();
      if (fyStartYear === currentFY) {
        setCurrentDate(new Date()); 
      } else {
        setCurrentDate(new Date(fyStartYear, 3, 1)); // April
      }
    }
  }, [selectedFY]);

  // Filters (Local sub-filters)
  const [filterTeam, setFilterTeam] = useState('');
  const [filterTrainer, setFilterTrainer] = useState('');


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
  const [selectedPlanningTeamIds, setSelectedPlanningTeamIds] = useState<string[]>([]);

  // Modal-only form state (no planning decisions made from these)
  const [formTrainer, setFormTrainer] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [overrideTrainer, setOverrideTrainer] = useState(false);

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

      // Log for debugging
      console.log('[Calendar] Opening modal. Session teamIds:', selectionSession!.teamIds);

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
      id: `${trainingId}_${teamId}`,
      teamId,
      trainingId,
      trainingType,
      team: teamLabel,
      trainer,
      startDate,
      endDate,
      candidates: top40,
      status: 'DRAFT',
      isCancelled: false,
      isVoided: false
    });

    console.log('[Draft] Saved. teamId:', teamId, 'candidates:', top40.length);
  };

  const handleCreatePlan = async () => {
    const sessionTeams = selectedPlanningTeamIds;
    if (sessionTeams.length === 0) {
      console.error('[Calendar] BLOCKED: No planning teamIds selected.');
      return alert('No planning teams selected. Please choose at least one team from the Planning banner.');
    }
    if (!formTrainer) return alert('Trainer is required.');

    const newId = Math.random().toString(36).substr(2, 9);

    const newTeams: TeamBatchStatus[] = sessionTeams.map(id => {
      const t = masterTeams.find(mt => mt.id === id);
      return {
        trainingId: newId,
        teamId: id,
        teamName: t ? t.teamName : getTeamName(id, masterTeams),
        status: 'OPEN'
      };
    });

    const newPlan: TrainingPlan = {
      id: newId,
      trainingType: tab,
      status: 'Planned',
      teams: newTeams,
      trainer: formTrainer,
      startDate: modalStart,
      endDate: modalEnd,
      remarks: formRemarks,
      checklist: (CHECKLIST_RULES[tab] || []).map(name => ({ name, completed: false }))
    };

    // No local setPlans call. Rely on drafts -> useEffect synchronization
    newTeams.forEach(t => addConsumed(t.teamId, formTrainer));

    for (const t of newTeams) {
      await generateNominationDraft({
        teamId: t.teamId,
        trainingId: newId,
        trainingType: tab,
        trainer: formTrainer,
        startDate: modalStart,
        endDate: modalEnd
      });
    }

    setShowCreateModal(false);
  };

  const handleDeletePlan = (id: string) => {
    if (!window.confirm("Delete this training plan?")) return;
    const plan = plans.find(p => p.id === id);
    if (plan) {
      plan.teams.forEach((t: any) => removeConsumed(t.teamId, plan.trainer));
      // Removing the draft will trigger the useMemo update
      removeDraft(plan.id);
    }
    setSelectedPlanId(null);
  };

  const handleCancelPlan = async (trainingId: string) => {
    const relatedDrafts = drafts.filter(d => d.trainingId === trainingId);
    if (relatedDrafts.length === 0) return;
    if (!window.confirm('This will cancel training and return employees to untrained pool')) return;

    for (const draft of relatedDrafts) {
      if (draft.status === 'COMPLETED' || draft.isCancelled) continue;
      const result = await cancelDraft(draft.id);
      if (!result.success) {
        alert(result.reason || 'Cancel failed.');
        return;
      }
    }
  };

  const handleScopeChange = async (batchId: string, teamIds: string[], action: 'ADD' | 'REMOVE') => {
    // This function will be called by TeamScopeManager
    // For now, we rely on the refetch props to keep UI in sync
    console.log(`[ScopeChange] batch: ${batchId}, teams: ${teamIds}, action: ${action}`);
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
    // setPlans(updatedPlans); // Local state 'setPlans' removed in global filter refactor.
    // TODO: Implement persistence for checklist items in NominationDraft
  };



  // Render Helpers
  const isDateInDragRange = (dateStr: string) => {
    if (!dragStart || !dragEnd) return false;
    const s = dragStart <= dragEnd ? dragStart : dragEnd;
    const e = dragStart <= dragEnd ? dragEnd : dragStart;
    return dateStr >= s && dateStr <= e;
  };

  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      // Training Type and Fiscal Year are already handled by useCalendarData
      // Local sub-filters (Team) are applied here
      if (filterTeam && !p.teams.some((t: any) => match(t.teamId, filterTeam))) return false;
      
      // If Global trainer filter is ALL, but local trainer filter is set
      if (globalFilters.trainer === 'ALL' && filterTrainer && !match(p.trainer, filterTrainer)) return false;
      
      return true;
    });
  }, [plans, filterTeam, filterTrainer, globalFilters.trainer]);


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
      </div>
      <FlowStepper currentStep={0} />

      {/* TABS REMOVED - Driven by GlobalFilterContext */}

      {hasPlanningContext && (
        <div className={styles.planningBanner}>
          <div className={styles.planningBannerContent}>
            <span className={styles.planningBannerTitle}>Planning for:</span>
            <div className={styles.planningBannerChips}>
              {selectionSession!.teamIds.map(id => {
                const isSelected = selectedPlanningTeamIds.includes(id);
                const t = masterTeams.find(mt => mt.id === id);

                return (
                  <button
                    key={id}
                    onClick={() => togglePlanningTeam(id)}
                    className={`badge ${isSelected ? 'badge-success' : 'badge-outline'} ${styles.planningChip}`}
                  >
                    {t ? t.teamName : id}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-center gap-2">
            <button className={`btn btn-secondary btn-sm`} onClick={() => setSelectedPlanningTeamIds([])}>
              Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* FILTER BAR & MONTH CONTROLS */}
      <div className={styles.filterBar}>
        <span className={styles.filterLabel}>View:</span>
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)} className={`form-input ${styles.filterSelect}`} title="Filter by Team" aria-label="Filter by Team">
          <option value="">All Teams</option>
          {masterTeams.filter(t => t.status === 'Active').sort((a, b) => safeSort(a.teamName, b.teamName)).map(t => (
            <option key={t.id} value={t.id}>{t.teamName}</option>
          ))}
        </select>

        <select value={filterTrainer} onChange={e => setFilterTrainer(e.target.value)} className={`form-input ${styles.filterSelect}`} title="Filter by Trainer" aria-label="Filter by Trainer">
          <option value="">All Trainers</option>
          {masterTrainers.filter(t => t.status === 'Active').sort((a, b) => safeSort(a.name, b.name)).map(t => (
            <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
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
                    const displayTeam = p.teams.map((t: any) => t.teamName).join(', ');
                    const trainerObj = masterTrainers.find(mt => mt.id === p.trainer);
                    const displayTrainer = trainerObj ? trainerObj.name : p.trainer;


                    return (
                      <div
                        key={p.id}
                        onClick={(e) => { e.stopPropagation(); setSelectedPlanId(p.id); }}
                        className={`${styles.planChip} ${status === 'Completed' ? styles.planChipCompleted : status === 'Notified' ? styles.planChipNotified : status === 'Cancelled' ? styles.planChipCancelled : styles.planChipPlanned}`}
                        title={status === 'Cancelled' ? 'This training was cancelled and excluded from analysis' : undefined}
                      >
                        <div className={styles.planChipContent}>
                          {resolveTrainerAvatar(p.trainer) ? (
                            <img 
                              src={resolveTrainerAvatar(p.trainer)!} 
                              alt="Trainer" 
                              className={styles.planAvatar} 
                            />
                          ) : (
                            <div className={styles.planAvatarPlaceholder}>
                              {p.trainer.slice(0, 1)}
                            </div>
                          )}
                          <div className={`${styles.planChipText} ${status === 'Cancelled' ? styles.planChipTextCancelled : ''}`}>
                            <span className={styles.planType}>{p.trainingType}</span>
                            <span className={styles.planTeam}>{displayTeam}</span>
                            <span className={styles.planTrainer}>{displayTrainer}</span>
                          </div>
                        </div>
                        <div className={`${styles.planDot} ${status === 'Completed' ? styles.planDotCompleted : status === 'Notified' ? styles.planDotNotified : status === 'Cancelled' ? styles.planDotCancelled : styles.planDotPlanned}`}></div>
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
                <label className={styles.formLabel}>Teams</label>
                <div className={styles.teamDisplay}>
                  {selectedPlanningTeamIds.map(id => masterTeams.find(t => t.id === id)?.teamName || id).join(', ') || '—'}
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
                        {t.name} ({t.category}) {isUsed ? '(Used)' : ''}

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
              {getStatus(selectedPlan) === 'Completed' && <span className={`badge ${styles.badgeCompleted} status-badge status-completed`}>Completed</span>}
              {getStatus(selectedPlan) === 'Notified' && <span className={`badge ${styles.badgeNotified} status-badge status-notified`}>Notified</span>}
              {getStatus(selectedPlan) === 'Planned' && <span className={`badge ${styles.badgePlanned} status-badge status-planned`}>Planned</span>}
              {getStatus(selectedPlan) === 'Cancelled' && <span className={`badge ${styles.badgeCancelled} status-badge status-cancelled`} title="This training was cancelled and excluded from analysis">Cancelled</span>}
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
                <div className={styles.detailFieldLabel}>Teams</div>
                <div className={styles.teamScopeContainer}>
                  <TeamScopeManager
                    trainingId={selectedPlan.id}
                    teams={selectedPlan.teams}
                    onScopeChange={handleScopeChange}
                    refetchCalendar={refreshTransactional}
                    refetchNomination={loadNotificationHistory}
                  />
                </div>
              </div>
              <div className={styles.detailField}>
                <div className={styles.detailFieldLabel}>Trainer</div>
                <div className={styles.detailFieldValue}>
                  <TrainerAvatar 
                    trainer={masterTrainers.find(mt => mt.id === selectedPlan.trainer) || { id: selectedPlan.trainer, name: selectedPlan.trainer }} 
                    size={32} 
                    showName={true} 
                  />
                </div>
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
                  selectedPlan.checklist.map((item: any, idx: number) => (
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
            {selectedPlan.status !== 'Completed' && selectedPlan.status !== 'Cancelled' && (
              <button
                className={`btn btn-secondary ${styles.cancelBtn}`}
                onClick={() => handleCancelPlan(selectedPlan.id)}
              >
                Cancel Training
              </button>
            )}
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



// --- Helper Component: TeamScopeManager ---
// Note: destructive features (Reset/Lock) were removed in rollback be2a522.
// This version focuses on listing teams currently in scope.
const TeamScopeManager = ({ 
  trainingId, 
  teams, 
  onScopeChange, 
  refetchCalendar, 
  refetchNomination 
}: { 
  trainingId: string; 
  teams: TeamBatchStatus[]; 
  onScopeChange: (bid: string, tids: string[], action: 'ADD' | 'REMOVE') => void;
  refetchCalendar: () => void;
  refetchNomination: () => void;
}) => {
  return (
    <div className={styles.scopeManager}>
      <div className={styles.scopeChips}>
        {teams.map(t => (
          <div key={t.teamId} className={`badge badge-outline ${styles.teamChipInline}`}>
            {t.teamName}
          </div>
        ))}
      </div>
      {teams.length === 0 && <p className="text-muted text-xs">No teams assigned.</p>}
    </div>
  );
};








