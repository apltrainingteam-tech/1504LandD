import React, { memo, useMemo } from 'react';
import API_BASE from '../../../config/api';

interface TrainerAvatarProps {
  trainer?: {
    id?: string;
    name?: string;
    avatarUrl?: string | null;
  } | null;
  size?: number;
  showName?: boolean;
  className?: string;
}

const TrainerAvatar: React.FC<TrainerAvatarProps> = memo(({ 
  trainer, 
  size = 32, 
  showName = false,
  className = ''
}) => {
  // Normalize base URL and path to avoid double slashes
  const baseUrl = API_BASE.replace('/api', '').replace(/\/$/, '');
  let rawUrl = trainer?.avatarUrl || null;
  
  // Guard against old local absolute paths
  if (rawUrl && (rawUrl.includes(':\\') || rawUrl.includes(':/') || rawUrl.includes('Users/'))) {
    rawUrl = null;
  }

  const avatarUrl = useMemo(() => {
    if (!rawUrl) return null;
    if (rawUrl.startsWith('http')) return rawUrl;
    const path = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    return `${baseUrl}${path}`;
  }, [rawUrl, baseUrl]);

  const initials = useMemo(() => {
    if (!trainer?.name) return '?';
    return trainer.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }, [trainer?.name]);

  // Generate a stable background color based on name
  const bgColor = useMemo(() => {
    if (!trainer?.name) return '#94a3b8';
    const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#ef4444'];
    let hash = 0;
    for (let i = 0; i < trainer.name.length; i++) {
      hash = trainer.name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }, [trainer?.name]);

  return (
    <div className={`flex items-center gap-8 ${className}`}>
      <div 
        className="flex-shrink-0 flex items-center justify-center rounded-full overflow-hidden border border-white/10"
        style={{ 
          width: size, 
          height: size,
          background: avatarUrl ? '#f1f5f9' : bgColor,
          fontSize: size * 0.4,
          fontWeight: 600,
          color: '#ffffff'
        }}
      >
        {avatarUrl ? (
          <img 
            src={avatarUrl} 
            alt={trainer?.name || 'Trainer'} 
            className="w-full h-full object-cover"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              // Fallback to initials happens via the container background and text
            }}
          />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {showName && trainer?.name && (
        <span className="text-sm font-medium">{trainer.name}</span>
      )}
    </div>
  );
});

export default TrainerAvatar;
