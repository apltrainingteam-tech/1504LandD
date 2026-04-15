import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Users, CheckCircle2, AlertTriangle, TrendingUp, Search, X, MapPin } from 'lucide-react';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, EligibilityRule } from '../../types/attendance';
import { computeGapAnalysis, GapAnalysisData, EmployeeGapDetail } from '../../services/gapAnalysisService';
import { getCollection } from '../../services/firestoreService';
import { KPIBox } from '../../components/KPIBox';

interface GapAnalysisProps {
  employees: Employee[];
  attendance: Attendance[];
  nominations: TrainingNomination[];
}

type TrainingTab = 'AP' | 'MIP' | 'Refresher' | 'Capsule';

const GapAnalysis: React.FC<GapAnalysisProps> = ({ employees, attendance, nominations }) => {
  const [tab, setTab] = useState<TrainingTab>('AP');
  const [expanded, setExpanded] = useState(new Set<string>());
  const [rules, setRules] = useState<EligibilityRule[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string>('');
  const [drilldownData, setDrilldownData] = useState<EmployeeGapDetail[] | null>(null);

  // Load rules
  React.useEffect(() => {
    getCollection('eligibility_rules').then(setRules);
  }, []);

  const { data, drilldownMap } = useMemo(() => {
    const zone = tab === 'Refresher' ? zoneFilter : undefined;
    return computeGapAnalysis(tab, employees, attendance, nominations, rules, zone);
  }, [tab, employees, attendance, nominations, rules, zoneFilter]);

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
  const totalActive = data.reduce((sum, d) => sum + d.totalActive, 0);
  const totalEligible = data.reduce((sum, d) => sum + d.eligible, 0);
  const totalUntrained = data.reduce((sum, d) => sum + d.untrained, 0);
  const coveragePercent = totalEligible > 0 ? ((totalEligible - totalUntrained) / totalEligible) * 100 : 0;

  const renderKPIs = () => {
    if (tab !== 'AP') return null;
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <KPIBox
          title="Total Active"
          value={totalActive}
          icon={Users}
          color="var(--accent-primary)"
        />
        <KPIBox
          title="Total Eligible"
          value={totalEligible}
          icon={CheckCircle2}
          color="var(--success)"
        />
        <KPIBox
          title="Total Untrained"
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
    const zones = ['East', 'West', 'North', 'South'];
    return (
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <MapPin size={16} />
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          style={{ 
            padding: '8px 12px', 
            borderRadius: '6px', 
            border: '1px solid var(--border-color)', 
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)'
          }}
        >
          <option value="">All Zones</option>
          {zones.map(zone => <option key={zone} value={zone}>{zone}</option>)}
        </select>
      </div>
    );
  };

  const renderTable = () => {
    const isMIP = tab === 'MIP';
    const isCapsule = tab === 'Capsule';

    return (
      <div className="glass-panel" style={{ overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Cluster / Team</th>
              {!isCapsule && <th style={{ textAlign: 'center' }}>Total Active</th>}
              {!isCapsule && <th style={{ textAlign: 'center' }}>Eligible</th>}
              <th style={{ textAlign: 'center' }}>Untrained</th>
              {!isCapsule && <th style={{ textAlign: 'center' }}>Untrained %</th>}
              {!isCapsule && !isMIP && <th style={{ textAlign: 'center' }}>&gt; 90 Days</th>}
              {isMIP && <th style={{ textAlign: 'center' }}>FLM</th>}
              {isMIP && <th style={{ textAlign: 'center' }}>SLM</th>}
              {isMIP && <th style={{ textAlign: 'center' }}>Sr Manager</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => {
              const isCluster = row.team === '';
              const key = isCluster ? row.cluster : `${row.cluster}-${row.team}`;
              const isExpanded = expanded.has(row.cluster);
              const indent = isCluster ? 0 : 20;

              if (!isCluster && !isExpanded) return null;

              return (
                <tr key={index} style={{ background: isCluster ? 'rgba(0,0,0,0.1)' : 'transparent' }}>
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
                  {!isCapsule && <td style={{ textAlign: 'center' }}>{row.untrainedPercent.toFixed(1)}%</td>}
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
                {drilldownData.map((emp, i) => (
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
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 700 }}>Gap Analysis</h1>
        <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0 0' }}>Identify training gaps across clusters and teams</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '24px' }}>
        {(['AP', 'MIP', 'Refresher', 'Capsule'] as TrainingTab[]).map(t => (
          <button
            key={t}
            className={`tab ${tab === t ? 'tab-active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {renderZoneFilter()}
      {renderKPIs()}
      {renderTable()}
      {renderDrilldownModal()}
    </div>
  );
};

export { GapAnalysis };