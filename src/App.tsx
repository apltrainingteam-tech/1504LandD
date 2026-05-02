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
  PinOff,
  ShieldAlert
} from 'lucide-react';
import { useTheme } from './core/context/ThemeContext';
import { FilterProvider } from './core/context/FilterProvider';
import { PlanningFlowProvider } from './core/context/PlanningFlowContext';
import { MasterDataProvider, useMasterData } from './core/context/MasterDataContext';
import { PageTransition } from './shared/components/ui/PageTransition';
import { SkeletonDashboard } from './shared/components/ui/SkeletonDashboard';
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
import { DefaulterTracking } from './features/srm/DefaulterTracking';
import { TrainingCalendar } from './features/calendar/TrainingCalendar';
import { MasterSettings } from './features/settings/MasterSettings';
import { EngineDebugPanel } from './core/debug/engine-debug/EngineDebugPanel';
import { PerformanceCharts } from './features/dashboard/PerformanceCharts';
import { DataQualityCenter } from './features/dashboard/DataQualityCenter';
import { AgentDebugPanel } from './features/debug/AgentDebugPanel';
import { ErrorBoundary } from './core/debug/ErrorBoundary';
import { GlobalFiltersBar } from './shared/components/GlobalFiltersBar';


// Services & Types
import { Employee } from './types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics as DemoType } from './types/attendance';

import { useAppData } from './shared/hooks/useAppData';
import { getCurrentUser } from './core/context/userContext';

type ViewMode = 'employees' | 'demographics' | 'attendance' | 'trainings' | 'reports' | 'nominations' | 'notification' | 'training-data' | 'gap-analysis' | 'performance-tables' | 'performance-charts' | 'performance' | 'srm' | 'defaulters' | 'calendar' | 'master-settings' | 'data-quality' | 'dev/engine-debug';
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
      { label: "SRM Dashboard", view: "srm", icon: Target },
      { label: "Defaulter Tracking", view: "defaulters", icon: ShieldAlert }
    ]
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "Upload Portal", view: "attendance", icon: UploadCloud },
      { label: "Data Quality", view: "data-quality", icon: ListChecks }
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
  
  // Sidebar State
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isSidebarCollapsed = !isSidebarPinned && !isSidebarHovered;

  const user = getCurrentUser();
  const isSuperAdmin = user.role === 'super_admin' || user.role === 'SUPERADMIN' as any;

  const {
    loading,
    refreshKey,
    setRefreshKey,
    emps,
    att,
    scs,
    noms,
    demos,
    filteredEmps,
    empFiltersActive,
    empSearch,
    setEmpSearch,
    empFilterDesignation,
    setEmpFilterDesignation,
    empFilterTeam,
    setEmpFilterTeam,
    empFilterZone,
    setEmpFilterZone
  } = useAppData();

  const renderView = () => {
    if (loading) {
      return <SkeletonDashboard />;
    }

    switch (view) {
      case 'reports': return (
        <ErrorBoundary componentName="ReportsAnalytics" propsSnapshot={{ employees: emps.length, attendance: att.length }}>
          <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} pageMode="overview" onNavigate={setView} />
        </ErrorBoundary>
      );
      case 'performance-tables':
      case 'performance': return (
        <ErrorBoundary componentName="ReportsAnalytics[performance-insights]" propsSnapshot={{ employees: emps.length }}>
          <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} pageMode="performance-insights" onNavigate={setView} />
        </ErrorBoundary>
      );
      case 'performance-charts': return (
        <ErrorBoundary componentName="PerformanceCharts" propsSnapshot={{ employees: emps.length, scores: scs.length }}>
          <PerformanceCharts employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} onNavigate={setView} />
        </ErrorBoundary>
      );
      case 'srm': return (
        <ErrorBoundary componentName="RecruitmentQuality" propsSnapshot={{ employees: emps.length, attendance: att.length }}>
          <RecruitmentQuality employees={emps} attendance={att} scores={scs} />
        </ErrorBoundary>
      );
      case 'defaulters': return (
        <ErrorBoundary componentName="DefaulterTracking">
          <DefaulterTracking />
        </ErrorBoundary>
      );
      case 'trainings': return (
        <ErrorBoundary componentName="TrainingsViewer" propsSnapshot={{ employees: emps.length }}>
          <TrainingsViewer employees={emps} attendance={att} scores={scs} />
        </ErrorBoundary>
      );
      case 'calendar': return (
        <ErrorBoundary componentName="TrainingCalendar" propsSnapshot={{ employees: emps.length }}>
          <TrainingCalendar employees={emps} attendance={att} />
        </ErrorBoundary>
      );
      case 'attendance': return (
        <ErrorBoundary componentName="AttendanceUploadStrict">
          <AttendanceUploadStrict onUploadComplete={() => {
            setRefreshKey(k => k + 1);
            setView('training-data');
          }} />
        </ErrorBoundary>
      );
      case 'nominations': return (
        <ErrorBoundary componentName="NominationsPage" propsSnapshot={{ employees: emps.length, nominations: noms.length }}>
          <NominationsPage employees={emps} nominations={noms} attendance={att} />
        </ErrorBoundary>
      );
      case 'notification': return (
        <ErrorBoundary componentName="NotificationPage" propsSnapshot={{ employees: emps.length }}>
          <NotificationPage allEmployees={emps} />
        </ErrorBoundary>
      );
      case 'training-data': return (
        <ErrorBoundary componentName="TrainingDataPage" propsSnapshot={{ employees: emps.length, attendance: att.length }}>
          <TrainingDataPage employees={emps} attendance={att} scores={scs} />
        </ErrorBoundary>
      );
      case 'employees': return (
        <ErrorBoundary componentName="Employees" propsSnapshot={{ employees: emps.length, filtered: filteredEmps.length }}>
          <Employees
            employees={emps}
            onUploadComplete={() => {
              setRefreshKey(k => k + 1);
              setView('employees');
            }}
            searchQuery={empSearch}
            onSearchChange={setEmpSearch}
            filterDesignation={empFilterDesignation}
            onFilterDesignationChange={setEmpFilterDesignation}
            filterTeam={empFilterTeam}
            onFilterTeamChange={setEmpFilterTeam}
            filterZone={empFilterZone}
            onFilterZoneChange={setEmpFilterZone}
            filteredEmployees={filteredEmps}
          />
        </ErrorBoundary>
      );
      case 'demographics': return (
        <ErrorBoundary componentName="Demographics">
          <Demographics />
        </ErrorBoundary>
      );
      case 'gap-analysis': return (
        <ErrorBoundary componentName="GapAnalysis" propsSnapshot={{ employees: emps.length, nominations: noms.length }}>
          <GapAnalysis employees={emps} attendance={att} nominations={noms} onNavigate={setView} />
        </ErrorBoundary>
      );
      case 'master-settings': return (
        <ErrorBoundary componentName="MasterSettings">
          <MasterSettings />
        </ErrorBoundary>
      );
      case 'data-quality': return (
        <ErrorBoundary componentName="DataQualityCenter">
          <DataQualityCenter />
        </ErrorBoundary>
      );
      case 'dev/engine-debug': return <EngineDebugPanel />;
      default: return (
        <ErrorBoundary componentName="ReportsAnalytics[default]">
          <ReportsAnalytics employees={emps} attendance={att} scores={scs} nominations={noms} demographics={demos} />
        </ErrorBoundary>
      );
    }
  };

  return (
    <>
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

          {/* SUPERADMIN-only Engine Debug link — DEV mode only */}
          {isSuperAdmin && process.env.NODE_ENV !== 'production' && (
            <div className="sidebar-section">
              <div className="section-title text-danger opacity-60">SYSTEM</div>
              <button
                className={`nav-item nav-item-debug ${'dev/engine-debug' === view ? 'active' : ''}`}
                onClick={() => setView('dev/engine-debug')}
                title="Engine Debug Panel (SUPERADMIN only)"
              >
                <Activity size={20} />
                <span>Engine Debug</span>
              </button>
            </div>
          )}
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
        <header className="header">
          <div className="global-search-container">
            <Search size={18} className="global-search-icon" />
            <input type="text" className="form-input global-search-input" placeholder="Search system globally..." />
          </div>
          
          <GlobalFiltersBar />

          <div className="flex-center">
            <button className="btn btn-secondary" title="Notifications" style={{ width: '40px', height: '40px', padding: 0, borderRadius: '8px', background: '#FFFFFF', border: '1px solid #D6DFFB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} style={{ stroke: '#0F1C3F', minWidth: '20px', minHeight: '20px' }} />
            </button>
          </div>
        </header>

        <div className="shell-kpi-row mt-4">
          <div
            className={`shell-kpi-card kpi-employees cursor-pointer ${view === 'employees' ? 'active' : ''}`}
            onClick={() => setView('employees')}
            title="Go to Employee Master"
          >
            <div className="shell-kpi-label">Employees</div>
            <div className="shell-kpi-value">
              {view === 'employees' && empFiltersActive
                ? <>{filteredEmps.length} <span className="shell-kpi-sub">/ {emps.length}</span></>
                : emps.length}
            </div>
            <div className="shell-kpi-detail">
              <span className="shell-kpi-dot"></span> All divisions
            </div>
          </div>
          <div className="shell-kpi-card kpi-attendance">
            <div className="shell-kpi-label">Attendance</div>
            <div className="shell-kpi-value">{att.length}</div>
            <div className="shell-kpi-detail">
              <span className="shell-kpi-dot"></span> 87.3% rate
            </div>
          </div>
          <div className="shell-kpi-card kpi-scores">
            <div className="shell-kpi-label">Scores</div>
            <div className="shell-kpi-value">{scs.length}</div>
            <div className="shell-kpi-detail">
              <span className="shell-kpi-dot"></span> Pending upload
            </div>
          </div>
          <div className="shell-kpi-card kpi-nominations">
            <div className="shell-kpi-label">Nominations</div>
            <div className="shell-kpi-value">{noms.length}</div>
            <div className="shell-kpi-detail">
              <span className="shell-kpi-dot"></span> No active cycle
            </div>
          </div>
        </div>
        <PageTransition pageKey={view}>
          {renderView()}
        </PageTransition>
      </main>
        </div>

        </FilterProvider>
      </PlanningFlowProvider>

      {/* Agent Debug Panel — SUPERADMIN + dev only, gated internally */}
      <AgentDebugPanel />
    </>
  );
};

export default App;








