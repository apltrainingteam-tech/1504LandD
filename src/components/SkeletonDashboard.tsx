import React from 'react';

export const SkeletonDashboard: React.FC = () => {
  const SkeletonCard = ({ width = '100%' }: { width?: string }) => (
    <div
      style={{
        width,
        height: '60px',
        background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 2s infinite',
        borderRadius: '12px',
        marginBottom: '12px',
      }}
    />
  );

  return (
    <div style={{ padding: '24px', animation: 'none' }}>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              width: '100px',
              height: '40px',
              background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 2s infinite',
              borderRadius: '8px',
            }}
          />
        ))}
      </div>

      {/* Chart Placeholder */}
      <div
        style={{
          height: '200px',
          background: 'linear-gradient(90deg, var(--bg-card) 25%, var(--bg-secondary) 50%, var(--bg-card) 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s infinite',
          borderRadius: '12px',
          marginBottom: '24px',
        }}
      />

      {/* Table Rows */}
      <div style={{ marginTop: '24px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
};
