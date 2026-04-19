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
  Moon
} from 'lucide-react';
import { useTheme } from './context/ThemeContext';
import { FilterProvider } from './context/FilterProvider';
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
import { Notified } from './features/notifications/Notified';
import { GapAnalysis } from './features/gap-analysis/GapAnalysis';
import { RecruitmentQuality } from './features/srm/RecruitmentQuality';

// Services & Types
import { getCollection, deleteRecordsByQuery } from './services/apiClient';
import { seedDatabase, seedMasterData } from './seed';
import { Employee } from './types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics as DemoType } from './types/attendance';

type ViewMode = 'employees' | 'demographics' | 'attendance' | 'trainings' | 'reports' | 'notified' | 'gap-analysis' | 'performance' | 'srm';

const App = () => {
  const { theme, toggleTheme } = useTheme();
  const [view, setView] = useState<ViewMode>('reports');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

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
        
        // Populate Attendance
        if (row.attendanceDate) {
          a.push({
            id: row._id || Math.random().toString(),
            employeeId: row.employeeId,
            trainingType: row.trainingType,
            attendanceDate: row.attendanceDate,
            attendanceStatus: row.attendanceStatus || 'Present',
            employeeStatus: row.employeeStatus || 'Active',
            aadhaarNumber: row.aadhaarNumber,
            mobileNumber: row.mobileNumber,
            name: row.name,
            team: row.team,
            designation: row.designation,
            hq: row.hq,
            state: row.state,
          } as Attendance);
        }

        // Populate Scores
        const scoreKeys = ['detailingScore', 'testScore', 'trainabilityScore', 'knowledgeScore', 'bseScore', 'graspingScore', 'participationScore', 'detailingPresentationScore', 'rolePlayScore', 'punctualityScore', 'groomingScore', 'behaviourScore', 'scienceScore', 'skillScore', 'situationHandlingScore', 'presentationScore'];
        
        const scoresObj: Record<string, number> = {};
        scoreKeys.forEach(k => {
          if (row[k] !== undefined && row[k] !== null) {
            scoresObj[k.replace('Score', '')] = row[k];
          }
        });

        if (Object.keys(scoresObj).length > 0) {
          s.push({
            id: row._id || Math.random().toString(),
            employeeId: row.employeeId,
            trainingType: row.trainingType,
            dateStr: row.attendanceDate,
            scores: scoresObj
          } as TrainingScore);
        }

        // Populate Nominations
        if (row.trainingType === 'PreAP' || row.notified) {
          n.push({
            id: row._id || Math.random().toString(),
            employeeId: row.employeeId,
            trainingType: row.trainingType,
            notificationDate: row.apDate || row.attendanceDate || '',
            month: (row.apDate || row.attendanceDate || '').substring(0, 7),
            notificationCount: 1,
            aadhaarNumber: row.aadhaarNumber || '',
            mobileNumber: row.mobileNumber || '',
            name: row.name || '',
            designation: row.designation || '',
            team: row.team || '',
            hq: row.hq || '',
            state: row.state || '',
          } as TrainingNomination);
        }
      });

      console.log('Loaded unified collections:', {
        employees: e.length,
        attendance_derived: a.length,
        scores_derived: s.length,
        nominations_derived: n.length,
        demographics: d.length
      });
      
      setEmps(e as Employee[]);
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
  }, [refreshKey]);

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
      case 'attendance': return <AttendanceUploadStrict onUploadComplete={() => setRefreshKey(k => k + 1)} />;
      case 'notified': return <Notified employees={emps} attendance={att} nominations={noms} onUploadComplete={() => setRefreshKey(k => k + 1)} />;
      case 'employees': return <Employees employees={emps} onUploadComplete={() => setRefreshKey(k => k + 1)} />;
      case 'demographics': return <Demographics />;
      case 'gap-analysis': return <GapAnalysis employees={emps} attendance={att} nominations={noms} />;
      default: return <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} />;
    }
  };

  return (
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
          {/* INTELLIGENCE SECTION */}
          <div className="nav-section-header">Intelligence</div>

          <button className={`nav-item ${view === 'reports' ? 'active' : ''}`} onClick={() => setView('reports')}>
            <BarChart3 size={20} />
            <span>Overview</span>
          </button>

          <button className={`nav-item ${view === 'gap-analysis' ? 'active' : ''}`} onClick={() => setView('gap-analysis')}>
            <Target size={20} />
            <span>Training Requirements</span>
          </button>

          <button className={`nav-item ${view === 'performance' ? 'active' : ''}`} onClick={() => setView('performance')}>
            <Activity size={20} />
            <span>Performance Insights</span>
          </button>

          <button className={`nav-item ${view === 'srm' ? 'active' : ''}`} onClick={() => setView('srm')}>
            <Target size={20} />
            <span>SRM (Recruitment Quality)</span>
          </button>

          {/* OPERATIONS SECTION */}
          <div className="nav-section-header" style={{ marginTop: '24px' }}>Operations</div>

          <button className={`nav-item ${view === 'attendance' ? 'active' : ''}`} onClick={() => setView('attendance')}>
            <CalendarCheck size={20} />
            <span>Upload Portal</span>
          </button>

          <button className={`nav-item ${view === 'trainings' ? 'active' : ''}`} onClick={() => setView('trainings')}>
            <FileText size={20} />
            <span>Training Data</span>
          </button>

          <button className={`nav-item ${view === 'notified' ? 'active' : ''}`} onClick={() => setView('notified')}>
            <Mail size={20} />
            <span>Nominations</span>
          </button>

          {/* FOUNDATION SECTION */}
          <div className="nav-section-header" style={{ marginTop: '24px' }}>Foundation</div>

          <button className={`nav-item ${view === 'employees' ? 'active' : ''}`} onClick={() => setView('employees')}>
            <Users size={20} />
            <span>Employee Master</span>
          </button>

          <button className={`nav-item ${view === 'demographics' ? 'active' : ''}`} onClick={() => setView('demographics')}>
            <ShieldCheck size={20} />
            <span>Eligibility Rules</span>
          </button>
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
  );
};

export default App;


