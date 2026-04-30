import React, { memo } from 'react';
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
  const baseUrl = API_BASE.replace('/api', '');
  let avatarUrl = trainer?.avatarUrl ? (trainer.avatarUrl.startsWith('http') ? trainer.avatarUrl : `${baseUrl}${trainer.avatarUrl}`) : null;
  
  // Guard against old local absolute paths (C:\ or similar)
  if (avatarUrl && (avatarUrl.includes(':\\') || avatarUrl.includes(':/') || avatarUrl.includes('Users/'))) {
    avatarUrl = null;
  }

  const initials = trainer?.name ? trainer.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';

  return (
    <div className={`flex items-center gap-8 ${className}`}>
      <div 
        className="flex-shrink-0 flex items-center justify-center rounded-full overflow-hidden bg-surface border border-white/10"
        style={{ width: size, height: size }}
      >
        <img 
          src={avatarUrl || '/default-avatar.png'} 
          alt={trainer?.name || 'Trainer'} 
          className="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = '/default-avatar.png';
          }}
        />
      </div>
      {showName && trainer?.name && (
        <span className="text-sm font-medium">{trainer.name}</span>
      )}
    </div>
  );
});

export default TrainerAvatar;
