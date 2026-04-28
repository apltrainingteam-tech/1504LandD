import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ShieldAlert, CheckCircle, Search, Filter } from 'lucide-react';
import { useMasterData } from '../../core/context/MasterDataContext';
import { Employee } from '../../types/employee';
import { NotificationRecord } from '../../types/attendance';
import styles from './DefaulterTracking.module.css';

interface DefaulterRecord {
  employeeId: string;
  name: string;
  team: string;
  designation: string;
  notificationCount: number;
  attendedCount: number;
  status: 'Critical' | 'Warning' | 'Compliant';
  lastNotificationDate: string;
  trainingType: string;
}

export const DefaulterTracking: React.FC = () => {
  const { finalData } = useMasterData();
  const { employeeData, notificationHistory, trainingData } = finalData;

  const defaulters = useMemo(() => {
    const records: Record<string, DefaulterRecord> = {};

    // 1. Process Notification History
    notificationHistory.forEach(nh => {
      const key = `${nh.empId}_${nh.trainingType}`;
      if (!records[key]) {
        const emp = employeeData.find(e => String(e.employeeId) === String(nh.empId));
        records[key] = {
          employeeId: nh.empId,
          name: emp?.name || nh.name || 'Unknown',
          team: nh.team,
          designation: nh.designation,
          notificationCount: 0,
          attendedCount: 0,
          status: 'Compliant',
          lastNotificationDate: nh.notificationDate,
          trainingType: nh.trainingType
        };
      }
      records[key].notificationCount++;
      if (new Date(nh.notificationDate) > new Date(records[key].lastNotificationDate)) {
        records[key].lastNotificationDate = nh.notificationDate;
      }
    });

    // 2. Process Attendance (from training_data)
    trainingData.forEach(td => {
      const key = `${td.employeeId}_${td.trainingType}`;
      if (records[key]) {
        // Any 'Present' status counts as attended for that training type
        if (String(td.attendanceStatus).toLowerCase() === 'present') {
          records[key].attendedCount++;
        }
      }
    });

    // 3. Determine Status
    return Object.values(records).map(r => {
      let status: 'Critical' | 'Warning' | 'Compliant' = 'Compliant';
      
      if (r.attendedCount > 0) {
        status = 'Compliant';
      } else if (r.notificationCount >= 3) {
        status = 'Critical';
      } else if (r.notificationCount > 0) {
        status = 'Warning';
      }

      return { ...r, status };
    }).sort((a, b) => {
      // Sort: Critical -> Warning -> Compliant
      const order = { Critical: 0, Warning: 1, Compliant: 2 };
      return order[a.status] - order[b.status] || b.notificationCount - a.notificationCount;
    });
  }, [employeeData, notificationHistory, trainingData]);

  const stats = useMemo(() => {
    return {
      total: defaulters.length,
      critical: defaulters.filter(d => d.status === 'Critical').length,
      warning: defaulters.filter(d => d.status === 'Warning').length,
      compliant: defaulters.filter(d => d.status === 'Compliant').length,
    };
  }, [defaulters]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <ShieldAlert size={32} className="text-danger" />
            Defaulter Tracking
          </h1>
          <p className={styles.subtitle}>Identify and track employees with multiple training notifications but zero attendance</p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <motion.div whileHover={{ y: -5 }} className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Critical Defaulters (3+)</span>
          <span className={`${styles.statValue} ${styles.criticalText}`}>{stats.critical}</span>
        </motion.div>
        <motion.div whileHover={{ y: -5 }} className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Warnings (1-2)</span>
          <span className={`${styles.statValue} ${styles.warningText}`}>{stats.warning}</span>
        </motion.div>
        <motion.div whileHover={{ y: -5 }} className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Total Notified</span>
          <span className={styles.statValue}>{stats.total}</span>
        </motion.div>
        <motion.div whileHover={{ y: -5 }} className={`glass-panel ${styles.statCard}`}>
          <span className={styles.statLabel}>Recently Trained</span>
          <span className={`${styles.statValue} ${styles.successText}`}>{stats.compliant}</span>
        </motion.div>
      </div>

      <div className={`glass-panel ${styles.tableContainer}`}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>Notification History Audit</h3>
          <div className="flex gap-4">
            <div className="search-container">
              <Search size={16} className="search-icon" />
              <input type="text" placeholder="Search employees..." className="form-input" />
            </div>
            <button className="btn btn-secondary">
              <Filter size={16} /> Filter
            </button>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Team</th>
              <th>Training Type</th>
              <th className="text-center">Notifications</th>
              <th className="text-center">Status</th>
              <th>Last Notified</th>
            </tr>
          </thead>
          <tbody>
            {defaulters.length === 0 ? (
              <tr>
                <td colSpan={7} className={styles.emptyState}>
                  No notification history records found.
                </td>
              </tr>
            ) : (
              defaulters.map((record, idx) => (
                <tr key={idx}>
                  <td className="font-mono text-xs">{record.employeeId}</td>
                  <td className="font-semibold">{record.name}</td>
                  <td>{record.team}</td>
                  <td><span className="badge badge-info">{record.trainingType}</span></td>
                  <td className="text-center">
                    <span className={styles.countCircle}>{record.notificationCount}</span>
                  </td>
                  <td className="text-center">
                    <span className={`${styles.badge} ${
                      record.status === 'Critical' ? styles.badgeCritical :
                      record.status === 'Warning' ? styles.badgeWarning :
                      styles.badgeCompliant
                    }`}>
                      {record.status === 'Critical' && <AlertTriangle size={12} className="mr-1" />}
                      {record.status === 'Compliant' && <CheckCircle size={12} className="mr-1" />}
                      {record.status}
                    </span>
                  </td>
                  <td className="text-muted text-sm">{record.lastNotificationDate}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
