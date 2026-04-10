import React from 'react';
import { Users, ShieldCheck } from 'lucide-react';

const StubHeader = ({ title, icon: Icon, desc }: { title: string, icon: any, desc: string }) => (
  <div style={{ textAlign: 'center', padding: '100px 20px' }} className="animate-fade-in">
    <div style={{ 
      background: 'var(--bg-card)', 
      width: '80px', 
      height: '80px', 
      borderRadius: '50%', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      margin: '0 auto 24px',
      color: 'var(--accent-primary)'
    }}>
      <Icon size={40} />
    </div>
    <h2 style={{ fontSize: '28px', marginBottom: '12px' }}>{title}</h2>
    <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto' }}>{desc}</p>
    <div className="glass-panel mt-8" style={{ display: 'inline-block', padding: '12px 24px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600 }}>Syncing with Firestore Collection...</span>
    </div>
  </div>
);

export const Employees = () => (
  <StubHeader title="Field Roster" icon={Users} desc="Management interface for field representatives, clusters, and reporting teams." />
);
