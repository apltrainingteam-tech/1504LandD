/**
 * KPI Registry
 * 
 * Central registry for KPI keys and labels used across the application.
 * Prevents scattered naming and ensures consistent data access keys.
 */
export const KPI_REGISTRY = {
  IP: {
    key: 'ipKPI',
    label: 'Initial Program',
    color: '#3b82f6'
  },
  AP: {
    key: 'apKPI',
    label: 'Advancement Program',
    color: '#10b981'
  },
  MIP: {
    key: 'mipKPI',
    label: 'Managerial Program',
    color: '#8b5cf6'
  },
  REFRESHER: {
    key: 'refresherKPI',
    label: 'Refresher Program',
    color: '#f59e0b'
  },
  CAPSULE: {
    key: 'capsuleKPI',
    label: 'Capsule Training',
    color: '#ec4899'
  },
  PRE_AP: {
    key: 'preApKPI',
    label: 'Pre-AP Training',
    color: '#6366f1'
  }
} as const;

export type KPIType = keyof typeof KPI_REGISTRY;
