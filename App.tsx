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
  RefreshCw
} from 'lucide-react';
import './index.css';

// Modular Pages
import { ReportsAnalytics } from './src/pages/ReportsAnalytics';
import { TrainingsViewer } from './src/pages/TrainingsViewer';
import { AttendanceUpload } from './src/pages/AttendanceUpload';
import { Employees } from './src/pages/Employees';
import { Demographics } from './src/pages/Demographics';

// Services & Types
import { getCollection } from './src/services/firestoreService';
import { seedDatabase, seedMasterData } from './src/seed';
import { Employee } from './src/types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics as DemoType } from './src/types/attendance';

type ViewMode = 'employees' | 'demographics' | 'attendance' | 'trainings' | 'reports';

const App = () => {
  const [view, setView] = useState<ViewMode>('reports');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);

  // Global State
  const [emps, setEmps] = useState<Employee[]>([]);
  const [att, setAtt] = useState<Attendance[]>([]);
  const [scs, setScs] = useState<TrainingScore[]>([]);
  const [noms, setNoms] = useState<TrainingNomination[]>([]);
  const [demos, setDemos] = useState<DemoType[]>([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [e, a, s, n, d] = await Promise.all([
        getCollection('employees'),
        getCollection('attendance'),
        getCollection('training_scores'),
        getCollection('training_nominations'),
        getCollection('demographics')
      ]);
      setEmps(e as Employee[]);
      setAtt(a as Attendance[]);
      setScs(s as TrainingScore[]);
      setNoms(n as TrainingNomination[]);
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

  const renderView = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <RefreshCw className="animate-spin" size={48} color="var(--accent-primary)" style={{ marginBottom: '20px' }} />
          <p className="text-muted">Syncing Intelligence Engine...</p>
        </div>
      );
    }

    switch (view) {
      case 'reports': return <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} />;
      case 'trainings': return <TrainingsViewer employees={emps} attendance={att} scores={scs} />;
      case 'attendance': return <AttendanceUpload onUploadComplete={() => setRefreshKey(k => k + 1)} />;
      case 'employees': return <Employees />;
      case 'demographics': return <Demographics />;
      default: return <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} />;
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{ width: '36px', height: '36px', background: 'var(--accent-gradient)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)' }}>
            <Activity size={22} color="white" />
          </div>
          <span className="gradient-text">PharmaIntel</span>
        </div>

        <nav style={{ flex: 1, marginTop: '24px' }}>
          <div className="text-muted" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', paddingLeft: '12px', fontWeight: '600' }}>Intelligence Modules</div>

          <button className={`nav-item w-full ${view === 'reports' ? 'active' : ''}`} onClick={() => setView('reports')} style={{ background: view === 'reports' ? 'var(--accent-gradient)' : 'rgba(99,102,241,0.05)', color: view === 'reports' ? '#fff' : 'var(--accent-primary)', marginBottom: '16px' }}>
            <BarChart3 size={20} /> Dashboard
          </button>

          <button className={`nav-item w-full ${view === 'attendance' ? 'active' : ''}`} onClick={() => setView('attendance')}>
            <CalendarCheck size={20} /> Upload Portal
          </button>

          <button className={`nav-item w-full ${view === 'trainings' ? 'active' : ''}`} onClick={() => setView('trainings')}>
            <FileText size={20} /> Trainings Viewer
          </button>

          <button className={`nav-item w-full ${view === 'employees' ? 'active' : ''}`} onClick={() => setView('employees')}>
            <Users size={20} /> Field Roster
          </button>

          <button className={`nav-item w-full ${view === 'demographics' ? 'active' : ''}`} onClick={() => setView('demographics')}>
            <ShieldCheck size={20} /> Eligibility
          </button>

          <button 
            className="nav-item w-full" 
            onClick={async () => { 
               setIsSeeding(true); 
               try {
                 await seedMasterData();
                 await seedDatabase();
                 alert('Database completely seeded with Mock & Master Data!');
                 setRefreshKey(k => k + 1); 
               } catch (e) {
                 alert('Seeding encountered an error');
               } finally {
                 setIsSeeding(false);
               }
            }} 
            style={{ marginTop: '24px', opacity: isSeeding ? 0.3 : 0.7 }}
            disabled={isSeeding}
          >
            {isSeeding ? <RefreshCw className="animate-spin" size={20} /> : <Database size={20} />} 
            {isSeeding ? "Seeding Data..." : "Seed Database"}
          </button>
        </nav>

        <div className="user-profile">
          <div className="avatar">AD</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>Admin User</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Firestore Live</div>
          </div>
          <button style={{ color: 'var(--text-secondary)' }}>
            <LogOut size={18} />
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
            <button className="btn btn-secondary" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '50%' }}>
              <Bell size={18} />
            </button>
          </div>
        </header>

        {renderView()}
      </main>
    </div>
  );
};

export default App;