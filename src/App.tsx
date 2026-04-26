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
import { TrainingCalendar } from './features/calendar/TrainingCalendar';
import { MasterSettings } from './features/settings/MasterSettings';
import { PerformanceCharts } from './features/dashboard/PerformanceCharts';

// Services & Types
import { getCollection, deleteRecordsByQuery } from './core/engines/apiClient';
import { seedMasterData } from './seed';
import { Employee } from './types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics as DemoType } from './types/attendance';
import { parseAnyDate } from './core/utils/dateParser';
import { normalizeScore } from './core/utils/scoreNormalizer';
import { getSchema, mapHeader } from './core/constants/trainingSchemas';
import { normalizeText } from './core/utils/textNormalizer';
import { getTeamId, mapTeamCodeToId } from './core/utils/teamIdMapper';

import { useAppData } from './shared/hooks/useAppData';

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
  
  // Sidebar State
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const isSidebarCollapsed = !isSidebarPinned && !isSidebarHovered;

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








