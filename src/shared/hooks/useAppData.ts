import { useState, useEffect, useMemo } from 'react';
import { getCollection, deleteRecordsByQuery } from '../../core/engines/apiClient';
import { seedMasterData } from '../../seed';
import { parseAnyDate } from '../../core/utils/dateParser';
import { normalizeScore } from '../../core/utils/scoreNormalizer';
import { getSchema, mapHeader } from '../../core/constants/trainingSchemas';
import { normalizeText } from '../../core/utils/textNormalizer';
import { mapTeamCodeToId } from '../../core/utils/teamIdMapper';
import { Employee } from '../../types/employee';
import { Attendance, TrainingScore, TrainingNomination, Demographics as DemoType } from '../../types/attendance';
import { useMasterData } from '../../core/context/MasterDataContext';

export const useAppData = () => {
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const { teams: masterTeams, loading: masterLoading } = useMasterData();

  const [emps, setEmps] = useState<Employee[]>([]);
  const [att, setAtt] = useState<Attendance[]>([]);
  const [scs, setScs] = useState<TrainingScore[]>([]);
  const [noms, setNoms] = useState<TrainingNomination[]>([]);
  const [demos, setDemos] = useState<DemoType[]>([]);

  // Employee Master filter state
  const [empSearch, setEmpSearch] = useState('');
  const [empFilterDesignation, setEmpFilterDesignation] = useState('');
  const [empFilterTeam, setEmpFilterTeam] = useState('');
  const [empFilterZone, setEmpFilterZone] = useState('');

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
    if (masterLoading) return;
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

        const r = row.mapped || row.data || row;
        let attendanceDate = r.attendanceDate || row.attendanceDate;
        if (attendanceDate) attendanceDate = parseAnyDate(attendanceDate) || attendanceDate;

        const trainingType = r.trainingType || row.trainingType;
        const employeeId = r.employeeId || r.aadhaarNumber || row.employeeId || row.aadhaarNumber;
        if (!employeeId) return;

        if (attendanceDate) {
          const teamRef = r.team || row.team;
          const teamId = mapTeamCodeToId(teamRef, masterTeams) || (teamRef ? `unmapped::${normalizeText(teamRef)}` : undefined);
          if (teamId) {
            a.push({
              id: row._id || Math.random().toString(),
              employeeId: String(employeeId),
              trainingType,
              attendanceDate,
              month: (attendanceDate as string).substring(0, 7),
              attendanceStatus: r.attendanceStatus || 'Present',
              employeeStatus: r.employeeStatus || 'Active',
              aadhaarNumber: r.aadhaarNumber || row.aadhaarNumber,
              mobileNumber: r.mobileNumber || row.mobileNumber,
              name: r.name || row.name,
              team: r.team || row.team,
              teamId,
              designation: r.designation || row.designation,
              hq: r.hq || row.hq,
              state: r.state || row.state,
            } as Attendance);
          }
        }

        const scoresObj: Record<string, number> = {};
        const schema = getSchema(trainingType);
        
        const extractBySchema = (source: any) => {
          if (!source) return;
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
            trainingType,
            dateStr: attendanceDate,
            scores: scoresObj
          } as TrainingScore);
        }

        if (trainingType === 'PreAP' || r.notified || row.notified) {
          let notificationDate = r.apDate || attendanceDate || '';
          if (notificationDate) notificationDate = parseAnyDate(notificationDate) || notificationDate;
          
          const teamRef = r.team || row.team;
          const teamId = mapTeamCodeToId(teamRef, masterTeams) || (teamRef ? `unmapped::${normalizeText(teamRef)}` : undefined);
          if (teamId) {
            n.push({
              id: row._id || Math.random().toString(),
              employeeId: String(employeeId),
              trainingType,
              notificationDate,
              month: (notificationDate as string).substring(0, 7),
              notificationCount: 1,
              aadhaarNumber: r.aadhaarNumber || row.aadhaarNumber || '',
              mobileNumber: r.mobileNumber || row.mobileNumber || '',
              name: r.name || row.name || '',
              designation: r.designation || row.designation || '',
              team: r.team || row.team || '',
              teamId,
              hq: r.hq || row.hq || '',
              state: r.state || row.state || '',
            } as TrainingNomination);
          }
        }
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

  return {
    loading,
    refreshKey,
    setRefreshKey,
    isSeeding,
    isCleaning,
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
    setEmpFilterZone,
    handleSeed,
    handlePurge
  };
};
