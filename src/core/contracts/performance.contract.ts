import { TrainingType } from '../../types/attendance';

/**
 * Performance Data Contract
 * 
 * This contract defines the strict structure returned by usePerformanceData hook.
 * All consumers (charts, tables, insights) must rely on this interface.
 */
export interface PerformanceDataset {
  MONTHS: string[];
  activeNT: TrainingType | string;
  rawUnified: any[];
  unified: any[];
  filteredData: any[];

  // Domain Data
  ipData: any;
  ipRankData: any;
  rawTimelines: Map<string, any>;
  filteredTimelines: Map<string, any>;

  // Attendance Matrices
  apAttData: any;
  mipAttData: any;
  refresherAttData: any;
  capsuleAttData: any;

  // Performance Matrices
  apPerfData: any;
  mipPerfData: any;
  refresherPerfData: any;
  capsulePerfData: any;

  // Eligibility & Metrics
  eligibilityResults: any[];
  gapMetrics: any;

  // Orchestration & Analytics
  groups: any[];
  ranked: any[];
  trainerStats: any;
  drilldownNodes: any[];
  months: string[];
  timeSeries: any[];
  tabNoms: any[];

  // KPIs
  executiveKPIs: any;
  apExecutiveKPIs: any;
  mipExecutiveKPIs: any;
  refresherKPI: any;
  capsuleKPI: any;
  overviewSummary: any[];
  isDebugMode?: boolean;
}
