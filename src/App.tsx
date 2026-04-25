import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  BarChart3,
  FileText,
  CalendarCheck,
  Activity,
  LogOut,
  Search,
  Bell,
  ShieldCheck,
  Database,
  RefreshCw,
  Mail,
  Trash2,
  AlertCircle,
  Target,
  Sun,
  Moon,
  Crosshair,
  ListChecks,
  ClipboardList,
  UploadCloud,
  Settings,
  Pin,
  PinOff
} from 'lucide-react';
import { useTheme } from './context/ThemeContext';
import { FilterProvider } from './context/FilterProvider';
import { PlanningFlowProvider } from './context/PlanningFlowContext';
import { MasterDataProvider, useMasterData } from './context/MasterDataContext';
import { PageTransition } from './components/PageTransition';
import { SkeletonDashboard } from './components/SkeletonDashboard';
import './index.css';

const logoUrl = new URL('./assets/ajanta-pharma-logo.svg', import.meta.url).href;

// Feature Pages
import { ReportsAnalytics } from './features/dashboard/ReportsAnalytics';
import { TrainingsViewer } from './features/viewer/TrainingsViewer';
import { AttendanceUploadStrict } from './features/uploads/AttendanceUploadStrict';
import { Employees } from './features/employees/Employees';
import { Demographics } from './features/eligibility/Demographics';
import { NominationsPage }  from './features/notifications/NominationsPage';
import { NotificationPage } from './features/notifications/NotificationPage';
import { TrainingDataPage } from './features/notifications/TrainingDataPage';
import { GapAnalysis } from './features/gap-analysis/GapAnalysis';
import { RecruitmentQuality } from './features/srm/RecruitmentQuality';
import { TrainingCalendar } from './features/calendar/TrainingCalendar';
import { MasterSettings } from './features/settings/MasterSettings';
import { PerformanceCharts } from './features/dashboard/PerformanceCharts';

// Services & Types
import { getCollection, deleteRecordsByQuery } from './services/apiClient';
import { seedDatabase, seedMasterData } from './seed';
import { Employee } from './types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics as DemoType } from './types/attendance';
import { parseAnyDate } from './utils/dateParser';
import { normalizeScore } from './utils/scoreNormalizer';
import { getSchema, mapHeader } from './services/trainingSchemas';
import { normalizeText } from './utils/textNormalizer';
import { getTeamId, mapTeamCodeToId } from './utils/teamIdMapper';

type ViewMode = 'employees' | 'demographics' | 'attendance' | 'trainings' | 'reports' | 'nominations' | 'notification' | 'training-data' | 'gap-analysis' | 'performance-tables' | 'performance-charts' | 'performance' | 'srm' | 'calendar' | 'master-settings';
interface SidebarItem {
  label: string;
  view: string;
  icon: React.ElementType;
  disabled?: boolean;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

const sidebarSections: SidebarSection[] = [
  {
    title: "REQUIREMENT",
    items: [
      { label: "Training Requirements", view: "gap-analysis", icon: Crosshair }
    ]
  },
  {
    title: "PLANNING",
    items: [
      { label: "Training Calendar", view: "calendar", icon: CalendarCheck }
    ]
  },
  {
    title: "EXECUTION",
    items: [
      { label: "Nominations",   view: "nominations",   icon: ClipboardList },
      { label: "Notification",  view: "notification",  icon: Mail          },
      { label: "Training Data", view: "training-data", icon: ListChecks    }
    ]
  },
  {
    title: "PERFORMANCE",
    items: [
      { label: "Performance Tables", view: "performance-tables", icon: FileText },
      { label: "Performance Charts", view: "performance-charts", icon: BarChart3 }
    ]
  },
  {
    title: "STRATEGY",
    items: [
      { label: "SRM Dashboard", view: "srm", icon: Target }
    ]
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "Upload Portal", view: "attendance", icon: UploadCloud }
    ]
  },
  {
    title: "FOUNDATION",
    items: [
      { label: "Employee Master", view: "employees", icon: Users },
      { label: "Eligibility Rules", view: "demographics", icon: ShieldCheck },
      { label: "Master Settings", view: "master-settings", icon: Settings }
    ]
  }
];

const App = () => {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<ViewMode>('reports');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const { teams: masterTeams, loading: masterLoading } = useMasterData();

  // Global State
  const [emps, setEmps] = useState<Employee[]>([]);
  const [att, setAtt] = useState<Attendance[]>([]);
  const [scs, setScs] = useState<TrainingScore[]>([]);
  const [noms, setNoms] = useState<TrainingNomination[]>([]);
  const [demos, setDemos] = useState<DemoType[]>([]);

  // Employee Master filter state (lifted so KPI card reflects filters)
  const [empSearch, setEmpSearch] = useState('');
  const [empFilterDesignation, setEmpFilterDesignation] = useState('');
  const [empFilterTeam, setEmpFilterTeam] = useState('');
  const [empFilterZone, setEmpFilterZone] = useState('');

  // Sidebar State
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isSidebarCollapsed = !isSidebarPinned && !isSidebarHovered;

  const filteredEmps = useMemo(() => emps.filter(e => {
    const q = empSearch.toLowerCase();
    const matchesSearch = !q ||
      (e.name || '').toLowerCase().includes(q) ||
      (e.employeeId || '').toLowerCase().includes(q);
    const matchesDesignation = !empFilterDesignation || e.designation === empFilterDesignation;
    const matchesTeam = !empFilterTeam || e.team === empFilterTeam;
    const matchesZone = !empFilterZone || e.zone === empFilterZone;
    return matchesSearch && matchesDesignation && matchesTeam && matchesZone;
  }), [emps, empSearch, empFilterDesignation, empFilterTeam, empFilterZone]);

  const empFiltersActive = !!(empSearch || empFilterDesignation || empFilterTeam || empFilterZone);

  const handleSeed = async () => {
    if (!confirm('Seed database with Master Data?')) return;
    setIsSeeding(true);
    const success = await seedMasterData();
    if (success) {
      setRefreshKey(k => k + 1);
    }
    setIsSeeding(false);
  };

  const loadAll = async () => {
    if (masterLoading) return; // Wait for master teams to map IDs
    setLoading(true);
    try {
      const [e, trainingDataRaw, d] = await Promise.all([
        getCollection('employees'),
        getCollection('training_data'),
        getCollection('demographics')
      ]);
      
      const a: Attendance[] = [];
      const s: TrainingScore[] = [];
      const n: TrainingNomination[] = [];

      (trainingDataRaw as any[]).forEach((row) => {
        if (!row) return;

        // UNWRAP: Some records might be nested in 'mapped' or 'data' due to enrichment/legacy storage
        const r = row.mapped || row.data || row;
        
        // Ensure root-level fields like attendanceDate/trainingType are preserved if they were outside 'mapped'
        let attendanceDate = r.attendanceDate || row.attendanceDate;
        if (attendanceDate) {
          attendanceDate = parseAnyDate(attendanceDate) || attendanceDate;
        }

        const trainingType = r.trainingType || row.trainingType;
        const employeeId = r.employeeId || r.aadhaarNumber || row.employeeId || row.aadhaarNumber;
        
        if (!employeeId) return;

        // Populate Attendance
        if (attendanceDate) {
          const teamId = mapTeamCodeToId(r.team || row.team, masterTeams);
          if (teamId) {
            a.push({
              id: row._id || Math.random().toString(),
              employeeId: String(employeeId),
              trainingType: trainingType,
              attendanceDate: attendanceDate,
              month: (attendanceDate as string).substring(0, 7),
              attendanceStatus: r.attendanceStatus || 'Present',
              employeeStatus: r.employeeStatus || 'Active',
              aadhaarNumber: r.aadhaarNumber || row.aadhaarNumber,
              mobileNumber: r.mobileNumber || row.mobileNumber,
              name: r.name || row.name,
              team: r.team || row.team,
              teamId: teamId,
              designation: r.designation || row.designation,
              hq: r.hq || row.hq,
              state: r.state || row.state,
            } as Attendance);
          } else {
            // Unmapped team, quietly skip since teamIdMapper logs uniquely.
          }
        }

        // Populate Scores - Using official training schema definitions
        const scoresObj: Record<string, number> = {};
        const schema = getSchema(trainingType);
        
        const extractBySchema = (source: any) => {
          if (!source) return;
          // Strategy: Scan all keys in source, map them using mapHeader, 
          // and if they match a scoreField in our schema, extract them.
          Object.keys(source).forEach(rawKey => {
            const canonicalKey = mapHeader(rawKey);
            if (schema.scoreFields.includes(canonicalKey)) {
              const val = source[rawKey];
              const normalized = normalizeScore(val);
              if (normalized !== null) {
                scoresObj[canonicalKey] = normalized;
              }
            }
          });
        };

        extractBySchema(r); 
        extractBySchema(row);

        if (Object.keys(scoresObj).length > 0) {
          s.push({
            id: row._id || Math.random().toString(),
            employeeId: String(employeeId),
            trainingType: trainingType,
            dateStr: attendanceDate,
            scores: scoresObj
          } as TrainingScore);
        }

        // Populate Nominations
        if (trainingType === 'PreAP' || r.notified || row.notified) {
          let notificationDate = r.apDate || attendanceDate || '';
          if (notificationDate) {
            notificationDate = parseAnyDate(notificationDate) || notificationDate;
          }
          
          const teamRef = r.team || row.team;
          const teamId = mapTeamCodeToId(teamRef, masterTeams) || (teamRef ? `unmapped::${normalizeText(teamRef)}` : undefined);
          if (teamId) {
            n.push({
              id: row._id || Math.random().toString(),
              employeeId: String(employeeId),
              trainingType: trainingType,
              notificationDate: notificationDate,
              month: (notificationDate as string).substring(0, 7),
              notificationCount: 1,
              aadhaarNumber: r.aadhaarNumber || row.aadhaarNumber || '',
              mobileNumber: r.mobileNumber || row.mobileNumber || '',
              name: r.name || row.name || '',
              designation: r.designation || row.designation || '',
              team: r.team || row.team || '',
              teamId: teamId,
              hq: r.hq || row.hq || '',
              state: r.state || row.state || '',
            } as TrainingNomination);
          }
        }
      });

      console.log('Loaded unified collections:', {
        employees: e.length,
        attendance_derived: a.length,
        scores_derived: s.length,
        nominations_derived: n.length,
        demographics: d.length
      });
      
      setEmps(((e as any[]).map(row => {
        const teamId = row.teamId || mapTeamCodeToId(row.team, masterTeams) || (row.team ? `unmapped::${normalizeText(row.team)}` : undefined);
        if (!teamId) return null;
        return {
          ...row,
          id: row.id || row._id,
          employeeId: String(row.employeeId),
          teamId
        };
      })).filter(Boolean) as Employee[]);
      setAtt(a);
      setScs(s);
      setNoms(n);
      setDemos(d as DemoType[]);
    } catch (err) {
      console.error('Failed to load collections:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [refreshKey, masterLoading]);

  const handlePurge = async () => {
    if (!window.confirm("This will PERMANENTLY delete all records for 'Team A' and 'Unknown' categories. Proceed?")) return;
    setIsCleaning(true);
    try {
      const dummyValues = ['Team A', 'Unknown', '—', 'Unknown Team', 'Unmapped'];
      
      const counts = await Promise.all([
        deleteRecordsByQuery('attendance', 'team', dummyValues),
        deleteRecordsByQuery('training_scores', 'team', dummyValues),
        deleteRecordsByQuery('employees', 'team', dummyValues)
      ]);

      const totalDeleted = counts.reduce((a, b) => a + b, 0);
      alert(`Cleanup Complete! ${totalDeleted} dummy records purged from live database.`);
      setRefreshKey(k => k + 1);
    } catch (e) {
      alert('Cleanup failed: ' + (e as any).message);
    } finally {
      setIsCleaning(false);
    }
  };

  const renderView = () => {
    if (loading) {
      return <SkeletonDashboard />;
    }

    switch (view) {
      case 'reports': return <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} pageMode="overview" onNavigate={setView} />;
      case 'performance-tables':
      case 'performance': return <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} pageMode="performance-insights" onNavigate={setView} />;
      case 'performance-charts': return <PerformanceCharts employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} onNavigate={setView} />;
      case 'srm': return <RecruitmentQuality employees={emps} attendance={att} scores={scs} />;
      case 'trainings': return <TrainingsViewer employees={emps} attendance={att} scores={scs} />;
      case 'calendar': return <TrainingCalendar employees={emps} attendance={att} />;
      case 'attendance': return <AttendanceUploadStrict onUploadComplete={() => setRefreshKey(k => k + 1)} />;
      case 'nominations':   return <NominationsPage  employees={emps} nominations={noms} attendance={att} />;
      case 'notification':  return <NotificationPage employees={emps} />;
      case 'training-data': return <TrainingDataPage  employees={emps} attendance={att} />;
      case 'employees': return <Employees
        employees={emps}
        onUploadComplete={() => setRefreshKey(k => k + 1)}
        searchQuery={empSearch}
        onSearchChange={setEmpSearch}
        filterDesignation={empFilterDesignation}
        onFilterDesignationChange={setEmpFilterDesignation}
        filterTeam={empFilterTeam}
        onFilterTeamChange={setEmpFilterTeam}
        filterZone={empFilterZone}
        onFilterZoneChange={setEmpFilterZone}
        filteredEmployees={filteredEmps}
      />;
      case 'demographics': return <Demographics />;
      case 'gap-analysis': return <GapAnalysis employees={emps} attendance={att} nominations={noms} onNavigate={setView} />;
      case 'master-settings': return <MasterSettings />;
      default: return <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} />;
    }
  };

  return (
    <PlanningFlowProvider>
      <FilterProvider>
        <div className={`app-container ${isSidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Sidebar Navigation */}
        <aside 
          className={`sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}
          onMouseEnter={() => setIsSidebarHovered(true)}
          onMouseLeave={() => setIsSidebarHovered(false)}
        >
        <div className="sidebar-logo">
          <img
            src={logoUrl}
            alt="Ajanta Pharma logo"
            className="brand-logo"
          />
          {!isSidebarCollapsed && (
            <button 
              className="pin-button"
              onClick={() => setIsSidebarPinned(!isSidebarPinned)}
              title={isSidebarPinned ? "Unpin sidebar" : "Pin sidebar"}
            >
              {isSidebarPinned ? <Pin size={16} /> : <PinOff size={16} />}
            </button>
          )}
        </div>

        <nav className="sidebar-nav">
          {sidebarSections.map((section, idx) => (
            <div key={section.title} className="sidebar-section">
              <div className="section-title">
                {section.title}
              </div>
              {section.items.map(item => {
                const Icon = item.icon;
                return (
                  <button 
                    key={item.view}
                    className={`nav-item ${view === item.view ? 'active' : ''} ${item.disabled ? 'nav-item-disabled' : ''}`}
                    onClick={() => !item.disabled && setView(item.view as ViewMode)}
                    disabled={item.disabled}
                    title={item.disabled ? "Training Calendar – Coming Soon" : ""}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="user-profile">
          <div className="avatar">AD</div>
          <div className="user-info-box">
            <div className="user-name">Admin User</div>
            <div className="user-role">Super Admin</div>
          </div>
          <button className="btn-icon text-muted" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header mb-24">
          <div className="global-search-container">
            <Search size={18} className="global-search-icon" />
            <input type="text" className="form-input global-search-input" placeholder="Search system globally..." />
          </div>
          <div className="flex-center">
            <button 
              className="btn btn-secondary theme-toggle-btn" 
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn btn-secondary theme-toggle-btn" title="Notifications">
              <Bell size={18} />
            </button>
          </div>
        </header>

        <div className="shell-kpi-row">
          <div
            className={`glass-panel shell-kpi-card cursor-pointer ${view === 'employees' ? 'active-border' : ''}`}
            onClick={() => setView('employees')}
            title="Go to Employee Master"
          >
            <div className="shell-kpi-label">Employees</div>
            <div className="shell-kpi-value">
              {view === 'employees' && empFiltersActive
                ? <>{filteredEmps.length} <span className="shell-kpi-sub">/ {emps.length}</span></>
                : emps.length}
            </div>
          </div>
          <div className="glass-panel shell-kpi-card">
            <div className="shell-kpi-label">Attendance</div>
            <div className="shell-kpi-value">{att.length}</div>
          </div>
          <div className="glass-panel shell-kpi-card">
            <div className="shell-kpi-label">Scores</div>
            <div className="shell-kpi-value">{scs.length}</div>
          </div>
          <div className="glass-panel shell-kpi-card">
            <div className="shell-kpi-label">Nominations</div>
            <div className="shell-kpi-value">{noms.length}</div>
          </div>
        </div>
        <PageTransition pageKey={view}>
          {renderView()}
        </PageTransition>
      </main>
        </div>
        </FilterProvider>
      </PlanningFlowProvider>
  );
};

export default App;
