import React, { useState, useEffect } from 'react';
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
  Settings
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

type ViewMode = 'employees' | 'demographics' | 'attendance' | 'trainings' | 'reports' | 'nominations' | 'notification' | 'training-data' | 'gap-analysis' | 'performance' | 'srm' | 'calendar' | 'master-settings';
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
      { label: "Performance", view: "performance", icon: BarChart3 }
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
          
          const teamId = mapTeamCodeToId(r.team || row.team, masterTeams);
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
          } else {
            // Unmapped team, quietly skip since teamIdMapper logs uniquely.
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
        const teamId = row.teamId || mapTeamCodeToId(row.team, masterTeams);
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
      case 'reports': return <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} pageMode="overview" />;
      case 'performance': return <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} pageMode="performance-insights" />;
      case 'srm': return <RecruitmentQuality employees={emps} attendance={att} scores={scs} />;
      case 'trainings': return <TrainingsViewer employees={emps} attendance={att} scores={scs} />;
      case 'calendar': return <TrainingCalendar employees={emps} attendance={att} />;
      case 'attendance': return <AttendanceUploadStrict onUploadComplete={() => setRefreshKey(k => k + 1)} />;
      case 'nominations':   return <NominationsPage  employees={emps} nominations={noms} />;
      case 'notification':  return <NotificationPage employees={emps} />;
      case 'training-data': return <TrainingDataPage  employees={emps} attendance={att} />;
      case 'employees': return <Employees employees={emps} onUploadComplete={() => setRefreshKey(k => k + 1)} />;
      case 'demographics': return <Demographics />;
      case 'gap-analysis': return <GapAnalysis employees={emps} attendance={att} nominations={noms} onNavigate={setView} />;
      case 'master-settings': return <MasterSettings />;
      default: return <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} />;
    }
  };

  return (
    <PlanningFlowProvider>
      <FilterProvider>
        <div className="app-container">
        {/* Sidebar Navigation */}
        <aside className="sidebar">
        <div className="sidebar-logo">
          <img
            src={logoUrl}
            alt="Ajanta Pharma logo"
            className="brand-logo"
            style={{
              width: 'auto',
              height: '40px',
              objectFit: 'contain',
              filter: 'none',
              opacity: 1,
              mixBlendMode: 'normal'
            }}
          />
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
                    className={`nav-item ${view === item.view ? 'active' : ''}`}
                    onClick={() => !item.disabled && setView(item.view as ViewMode)}
                    disabled={item.disabled}
                    title={item.disabled ? "Training Calendar – Coming Soon" : ""}
                    style={item.disabled ? { opacity: 0.5, cursor: 'not-allowed', backgroundColor: 'transparent' } : {}}
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
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>Admin User</div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Super Admin</div>
          </div>
          <button style={{ color: 'var(--text-secondary)', padding: '4px' }}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        <header className="header" style={{ marginBottom: '24px' }}>
          <div style={{ position: 'relative', width: '320px' }}>
            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input type="text" className="form-input" placeholder="Search system globally..." style={{ paddingLeft: '48px', background: 'var(--bg-card)', border: 'none', borderRadius: '24px' }} />
          </div>
          <div className="flex-center">
            <button 
              className="btn btn-secondary" 
              onClick={toggleTheme}
              style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="btn btn-secondary" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}>
              <Bell size={18} />
            </button>
          </div>
        </header>

        <div style={{ marginBottom: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div className="glass-panel" style={{ padding: '12px 16px', minWidth: '180px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Employees</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{emps.length}</div>
          </div>
          <div className="glass-panel" style={{ padding: '12px 16px', minWidth: '180px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Attendance</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{att.length}</div>
          </div>
          <div className="glass-panel" style={{ padding: '12px 16px', minWidth: '180px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Scores</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{scs.length}</div>
          </div>
          <div className="glass-panel" style={{ padding: '12px 16px', minWidth: '180px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Nominations</div>
            <div style={{ fontSize: '18px', fontWeight: 700 }}>{noms.length}</div>
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
