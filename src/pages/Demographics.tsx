import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const Demographics = () => (
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
      <ShieldCheck size={40} />
    </div>
    <h2 style={{ fontSize: '28px', marginBottom: '12px' }}>Eligibility Engine</h2>
    <p className="text-muted" style={{ maxWidth: '400px', margin: '0 auto' }}>Automated eligibility status tracking based on tenure and training cycles.</p>
    <div className="glass-panel mt-8" style={{ display: 'inline-block', padding: '12px 24px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600 }}>Syncing with Firestore Collection...</span>
    </div>
  </div>
);
