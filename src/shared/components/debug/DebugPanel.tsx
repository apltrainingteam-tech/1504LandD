import React, { useState, useEffect } from 'react';
import { Terminal, Bug, Play, Trash2, ChevronDown, ChevronUp, Layers, Activity } from 'lucide-react';
import { DEBUG_MODE } from '../../../core/constants/debugConfig';
import { getTraceLogs, clearTraceLogs, TraceLog } from '../../../core/debug/traceEngine';
import { getPipelineLog, clearPipelineLog, PipelineStep } from '../../../core/debug/pipelineTracer';
import { getAllSnapshots, clearSnapshots } from '../../../core/debug/snapshotStore';
import { replaySession } from '../../../core/debug/debugSession';
import styles from './DebugPanel.module.css';

export const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [traces, setTraces] = useState<TraceLog[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStep[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<'traces' | 'pipeline' | 'snapshots'>('traces');

  useEffect(() => {
    if (!DEBUG_MODE) return;

    const interval = setInterval(() => {
      setTraces(getTraceLogs());
      setPipeline(getPipelineLog());
      setSnapshots(getAllSnapshots());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!DEBUG_MODE) return null;

  const handleClear = () => {
    clearTraceLogs();
    clearPipelineLog();
    clearSnapshots();
    setTraces([]);
    setPipeline([]);
    setSnapshots({});
  };

  const handleReplay = () => {
    console.log("[Debug] Replaying last session...");
    replaySession((input) => {
      console.log("[Replay Input]", input);
      // This will trigger re-renders in hooks that use this input
      alert("Replay triggered. Check console for input data.");
    });
  };

  if (!isOpen) {
    return (
      <div className={`${styles.debugPanel} ${styles.minimized}`} onClick={() => setIsOpen(true)}>
        <div className={styles.title}>
          <Bug size={16} />
          <span>Execution Debug Layer</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.debugPanel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <Bug size={18} />
          <span>Execution Debug Layer</span>
        </div>
        <div className="flex gap-2">
          <button className={styles.toggleBtn} onClick={handleClear} title="Clear Logs">
            <Trash2 size={16} />
          </button>
          <button className={styles.toggleBtn} onClick={() => setIsOpen(false)}>
            <ChevronDown size={18} />
          </button>
        </div>
      </div>

      <div className="flex border-b border-white/10">
        <button 
          className={`flex-1 py-8 text-xs font-bold uppercase transition-all ${activeTab === 'traces' ? 'text-primary bg-white/5' : 'text-muted'}`}
          onClick={() => setActiveTab('traces')}
        >
          <div className="flex-center gap-2"><Activity size={12} /> Traces</div>
        </button>
        <button 
          className={`flex-1 py-8 text-xs font-bold uppercase transition-all ${activeTab === 'pipeline' ? 'text-primary bg-white/5' : 'text-muted'}`}
          onClick={() => setActiveTab('pipeline')}
        >
          <div className="flex-center gap-2"><Terminal size={12} /> Pipeline</div>
        </button>
        <button 
          className={`flex-1 py-8 text-xs font-bold uppercase transition-all ${activeTab === 'snapshots' ? 'text-primary bg-white/5' : 'text-muted'}`}
          onClick={() => setActiveTab('snapshots')}
        >
          <div className="flex-center gap-2"><Layers size={12} /> Snaps</div>
        </button>
      </div>

      <div className={styles.content}>
        {activeTab === 'traces' && (
          <div className={styles.section}>
            {traces.length === 0 && <div className="text-center py-20 text-muted italic text-xs">No execution traces recorded.</div>}
            {traces.slice().reverse().map((t, i) => (
              <div key={i} className={styles.traceItem}>
                <div className={styles.traceHeader}>
                  <span className={styles.engineName}>{t.engine}</span>
                  <span className={styles.duration}>{t.duration.toFixed(2)}ms</span>
                </div>
                {t.error && <div className={`${styles.jsonView} ${styles.error}`}>{JSON.stringify(t.error, null, 2)}</div>}
                <details>
                  <summary className="text-xs text-muted cursor-pointer hover:text-white">Input / Output</summary>
                  <div className={styles.jsonView}>
                    <strong>Input:</strong> {JSON.stringify(t.input, null, 2)}
                    <br/><br/>
                    <strong>Output:</strong> {JSON.stringify(t.output, null, 2)}
                  </div>
                </details>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'pipeline' && (
          <div className={styles.section}>
            {pipeline.length === 0 && <div className="text-center py-20 text-muted italic text-xs">Pipeline has not started.</div>}
            {pipeline.map((p, i) => (
              <div key={i} className={styles.stepItem}>
                <div className={`${styles.statusIcon} ${p.status === 'ok' ? styles.statusOk : styles.statusFailed}`} />
                <span className={p.status === 'failed' ? 'text-danger' : ''}>{p.step}</span>
                {p.error && <span className="text-xs text-danger opacity-70">— {p.error}</span>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'snapshots' && (
          <div className={styles.section}>
            {Object.keys(snapshots).length === 0 && <div className="text-center py-20 text-muted italic text-xs">No data snapshots available.</div>}
            {Object.entries(snapshots).map(([key, data]) => (
              <details key={key} className={styles.traceItem}>
                <summary className="text-xs font-bold text-primary cursor-pointer uppercase">{key}</summary>
                <div className={styles.jsonView}>{JSON.stringify(data, null, 2)}</div>
              </details>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button className="btn btn-primary btn-sm w-full flex-center gap-2" onClick={handleReplay}>
          <Play size={14} />
          Deterministic Replay
        </button>
      </div>
    </div>
  );
};
