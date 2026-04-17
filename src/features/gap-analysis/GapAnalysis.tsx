import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Users, CheckCircle2, AlertTriangle, TrendingUp, Search, X, MapPin } from 'lucide-react';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination } from '../../types/attendance';
import { STATE_ZONE } from '../../seed/masterData';
import { computeGapAnalysis, GapAnalysisData, EmployeeGapDetail } from '../../services/gapAnalysisService';
import { KPIBox } from '../../components/KPIBox';
import { InsightStrip } from '../../components/InsightStrip';

// Zone lookup from state
const getZoneFromState = (state?: string): string => {
  if (!state) return 'Unknown';
  const normalized = state.toUpperCase().trim();
  const stateZone = STATE_ZONE.find(sz => sz.state.toUpperCase() === normalized);
  return stateZone?.zone || 'Unknown';
};

interface GapAnalysisProps {
  employees: Employee[];
  attendance: Attendance[];
  nominations: TrainingNomination[];
}

type TrainingTab = 'AP' | 'MIP' | 'Refresher' | 'Capsule';

const GapAnalysis = ({ employees, attendance, nominations }: GapAnalysisProps) => {
  const [tab, setTab] = useState<TrainingTab>('AP');
  const [expanded, setExpanded] = useState(new Set<string>());
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [drilldownData, setDrilldownData] = useState<EmployeeGapDetail[] | null>(null);

  // Get unique zones from masterData
  const zones = useMemo(() => {
    const uniqueZones = new Set(STATE_ZONE.map(sz => sz.zone));
    return ['All Zones', ...Array.from(uniqueZones).sort()];
  }, []);

  const { data, drilldownMap } = useMemo(() => {
    // Filter employees by zone if Refresher tab and zone filter selected
    let filteredEmployees = employees;
    if (tab === 'Refresher' && zoneFilter) {
      filteredEmployees = employees.filter(emp => {
        const empZone = emp.zone || getZoneFromState(emp.state);
        return empZone === zoneFilter;
      });
    }
    
    console.log(`📊 GAP ANALYSIS: Tab=${tab}, Zone=${zoneFilter || 'All'}, FilteredEmployees=${filteredEmployees.length}, TotalEmployees=${employees.length}`);
    
    const result = computeGapAnalysis(tab, filteredEmployees, attendance, nominations, zoneFilter);
    console.log(`✓ RESULT for ${tab}: ${result.data.length} rows`);
    if (result.data.length > 0) {
      console.log(`  - Total Active: ${result.data.reduce((s, d) => s + d.totalActive, 0)}`);
      console.log(`  - Total Eligible: ${result.data.reduce((s, d) => s + d.eligible, 0)}`);
    }
    return result;
  }, [tab, employees, attendance, nominations, zoneFilter]);

  const toggleExpanded = (key: string) => {
    const newExpanded = new Set(expanded);
    if (newExpanded.has(key)) newExpanded.delete(key);
    else newExpanded.add(key);
    setExpanded(newExpanded);
  };

  const handleTeamClick = (cluster: string, team: string) => {
    const key = `${cluster}-${team}`;
    const details = drilldownMap.get(key) || [];
    setDrilldownData(details);
  };

  const closeDrilldown = () => setDrilldownData(null);

  // KPI calculations for AP
  const totalActive = data.reduce((sum: number, d: GapAnalysisData) => sum + d.totalActive, 0);
  const totalEligible = data.reduce((sum: number, d: GapAnalysisData) => sum + d.eligible, 0);
  const totalUntrained = data.reduce((sum: number, d: GapAnalysisData) => sum + d.untrained, 0);
  const coveragePercent = totalEligible > 0 ? ((totalEligible - totalUntrained) / totalEligible) * 100 : 0;

  React.useEffect(() => {
    // Logger for debugging (optional - can be removed in production)
  }, [tab, totalActive, totalEligible, totalUntrained, coveragePercent]);

  const renderKPIs = () => {
    // Show KPIs for all tabs
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <KPIBox
          title="Total Employees"
          value={totalActive}
          icon={Users}
          color="var(--accent-primary)"
        />
        <KPIBox
          title="Eligible for Training"
          value={totalEligible}
          icon={CheckCircle2}
          color="var(--success)"
        />
        <KPIBox
          title="Pending Training"
          value={totalUntrained}
          icon={AlertTriangle}
          color="var(--warning)"
        />
        <KPIBox
          title="Coverage %"
          value={`${coveragePercent.toFixed(1)}%`}
          icon={TrendingUp}
          color="var(--info)"
        />
      </div>
    );
  };

  const renderZoneFilter = () => {
    if (tab !== 'Refresher') return null;
    return (
      <div className="gap-filter-container">
        <span className="gap-filter-label">
          <MapPin size={16} />
          Zone:
        </span>
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="gap-select"
        >
          {zones.map(zone => (
            <option key={zone} value={zone === 'All Zones' ? '' : zone}>
              {zone}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const renderGapInsight = () => {
    return (
      <div className="gap-insight">
        <div className="gap-insight-item">
          <span className="gap-insight-icon">🎯</span>
          <div>
            <div className="gap-insight-label">Eligible</div>
            <div className="gap-insight-value">{totalEligible}</div>
          </div>
        </div>
        <div className="gap-insight-divider"></div>
        <div className="gap-insight-item">
          <span className="gap-insight-icon">📉</span>
          <div>
            <div className="gap-insight-label">Untrained</div>
            <div className="gap-insight-value">{totalUntrained}</div>
          </div>
        </div>
        <div className="gap-insight-divider"></div>
        <div className="gap-insight-item">
          <span className="gap-insight-icon">📈</span>
          <div>
            <div className="gap-insight-label">Coverage</div>
            <div className="gap-insight-value">{coveragePercent.toFixed(1)}%</div>
          </div>
        </div>
      </div>
    );
  };

  const renderEmptyState = () => {
    if (data.length > 0) return null;
    return (
      <div className="gap-empty-state">
        <div className="gap-empty-icon">📊</div>
        <div className="gap-empty-title">No Data Available</div>
        <div className="gap-empty-text">No eligible employees found for {tab} training</div>
      </div>
    );
  };

  const renderTable = () => {
    const isMIP = tab === 'MIP';
    const isCapsule = tab === 'Capsule';

    return (
      <div className="gap-table-container glass-panel">
        <table className="data-table gap-data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Cluster / Team</th>
              {!isCapsule && <th style={{ textAlign: 'center' }}>Total Active</th>}
              {!isCapsule && <th style={{ textAlign: 'center' }}>Eligible</th>}
              <th style={{ textAlign: 'center' }}>Untrained</th>
              {!isCapsule && <th style={{ textAlign: 'center' }} title="Percentage of eligible employees not yet trained">Untrained %</th>}
              {!isCapsule && !isMIP && <th style={{ textAlign: 'center' }}>&gt; 90 Days</th>}
              {isMIP && <th style={{ textAlign: 'center' }}>FLM</th>}
              {isMIP && <th style={{ textAlign: 'center' }}>SLM</th>}
              {isMIP && <th style={{ textAlign: 'center' }}>Sr Manager</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row: GapAnalysisData, index: number) => {
              const isCluster = row.team === '';
              const key = isCluster ? row.cluster : `${row.cluster}-${row.team}`;
              const isExpanded = expanded.has(row.cluster);
              const indent = isCluster ? 0 : 20;
              const isCritical = !isCluster && row.untrainedPercent > 70;

              if (!isCluster && !isExpanded) return null;

              return (
                <tr 
                  key={index} 
                  className={isCritical ? 'gap-critical-row' : ''}
                  style={{ background: isCluster ? 'rgba(0,0,0,0.1)' : 'transparent' }}
                >
                  <td>
                    {isCluster && (
                      <button
                        onClick={() => toggleExpanded(row.cluster)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    )}
                  </td>
                  <td 
                    style={{ paddingLeft: `${indent}px`, fontWeight: isCluster ? 600 : 400, cursor: !isCluster ? 'pointer' : 'default', color: !isCluster ? 'var(--accent-primary)' : 'inherit' }}
                    onClick={() => !isCluster && handleTeamClick(row.cluster, row.team)}
                  >
                    {isCluster ? row.cluster : `↳ ${row.team}`}
                  </td>
                  {!isCapsule && <td style={{ textAlign: 'center' }}>{row.totalActive}</td>}
                  {!isCapsule && <td style={{ textAlign: 'center' }}>{row.eligible}</td>}
                  <td
                    style={{ textAlign: 'center', fontWeight: 600, cursor: !isCluster ? 'pointer' : 'default' }}
                    onClick={() => !isCluster && handleTeamClick(row.cluster, row.team)}
                  >
                    {row.untrained}
                  </td>
                  {!isCapsule && (
                    <td style={{ textAlign: 'center' }}>
                      <div className="gap-metric-cell">
                        <div className="gap-progress-bar">
                          <div 
                            className="gap-progress-fill"
                            style={{ width: `${row.untrainedPercent}%` }}
                          ></div>
                        </div>
                        <span className={isCritical ? 'gap-critical-text' : ''}>{row.untrainedPercent.toFixed(1)}%</span>
                      </div>
                    </td>
                  )}
                  {!isCapsule && !isMIP && <td style={{ textAlign: 'center' }}>{row.over90Days}</td>}
                  {isMIP && <td style={{ textAlign: 'center' }}>{row.flmUntrained || 0}</td>}
                  {isMIP && <td style={{ textAlign: 'center' }}>{row.slmUntrained || 0}</td>}
                  {isMIP && <td style={{ textAlign: 'center' }}>{row.srManagerUntrained || 0}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const renderDrilldownModal = () => {
    if (!drilldownData) return null;

    return (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-panel" style={{ width: '900px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Untrained Employees</h3>
            <button className="btn btn-secondary" onClick={closeDrilldown}><X size={18} /></button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '20px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Emp ID</th>
                  <th>Name</th>
                  <th>Designation</th>
                  <th>Cluster</th>
                  <th>Team</th>
                  <th>DOJ</th>
                  <th>Days Since</th>
                </tr>
              </thead>
              <tbody>
                {drilldownData.map((emp: EmployeeGapDetail, i: number) => (
                  <tr key={i}>
                    <td>{emp.employeeId}</td>
                    <td>{emp.name}</td>
                    <td>{emp.designation}</td>
                    <td>{emp.cluster}</td>
                    <td>{emp.team}</td>
                    <td>{emp.dateOfJoining}</td>
                    <td>{emp.daysSinceJoining}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Page Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Training Requirements</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0', fontSize: '13px' }}>Identify required vs completed training across teams</p>
      </div>

      {/* Tabs - Pill Style */}
      <div className="gap-tabs">
        {(['AP', 'MIP', 'Refresher', 'Capsule'] as TrainingTab[]).map(t => (
          <button
            key={t}
            className={`gap-tab ${tab === t ? 'gap-tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {renderZoneFilter()}
      
      {/* KPIs */}
      {renderKPIs()}

      {/* Insight Strip */}
      <InsightStrip
        text="Cardiac cluster has highest pending load; coverage below 15%."
        variant="warning"
        icon="alert"
      />
      
      {/* Empty State or Table */}
      {renderEmptyState()}
      {data.length > 0 && renderTable()}
      
      {renderDrilldownModal()}
    </div>
  );
};

export { GapAnalysis };

