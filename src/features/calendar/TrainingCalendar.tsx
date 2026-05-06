import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, X, AlertTriangle, Calendar as CalIcon, Save } from 'lucide-react';
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

interface TrainingPlan {
  id: string;
  trainingType: string;
  status: TrainingPlanStatus;
  teams: TeamBatchStatus[];
  trainer: string;
  startDate: string;
  endDate: string;
  remarks?: string;
}

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
  return 'Planned';
};


import { useCalendarData } from '../../shared/hooks/useCalendarData';
import { useGlobalFilters } from '../../core/context/GlobalFilterContext';

export const TrainingCalendar = ({ employees, attendance }: { employees: Employee[], attendance: Attendance[] }) => {
  const { filters: globalFilters, setFilters } = useGlobalFilters();
  const { trainers: masterTrainers, teams: masterTeams, refreshTransactional } = useMasterData();
  const { plans } = useCalendarData();


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
      remarks: formRemarks
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


                    return (
                      <div
                        key={p.id}
                        className={`${styles.planChip} ${status === 'Completed' ? styles.planChipCompleted : status === 'Notified' ? styles.planChipNotified : status === 'Cancelled' ? styles.planChipCancelled : styles.planChipPlanned} ${styles.planChipStatic}`}
                        title={status === 'Cancelled' ? 'This training was cancelled and excluded from analysis' : undefined}
                      >
                        <div className={styles.planChipContent}>
                          <TrainerAvatar 
                            trainer={masterTrainers.find(mt => mt.id === p.trainer) || { id: p.trainer, name: p.trainer }} 
                            size={18} 
                            showName={true}
                            className={styles.planAvatar} 
                          />
                          <div className={`${styles.planChipText} ${status === 'Cancelled' ? styles.planChipTextCancelled : ''}`}>
                            <span className={styles.planType}>{p.trainingType}</span>
                            <span className={styles.planTeam}>{displayTeam}</span>
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


    </div>
  );
};











