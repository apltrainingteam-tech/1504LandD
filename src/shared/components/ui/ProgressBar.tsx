import React from 'react';
import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  width: number | string;
  className?: string;
  colorClass?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ width, className = '', colorClass = '' }) => {
  const fillRef = React.useRef<HTMLDivElement>(null);
  const widthStr = typeof width === 'number' ? `${Math.min(100, Math.max(0, width))}%` : width;

  React.useEffect(() => {
    if (fillRef.current) {
      fillRef.current.style.setProperty('--progress-width', widthStr);
    }
  }, [widthStr]);
  
  return (
    <div className={`${styles.container} ${className}`}>
      <div 
        ref={fillRef}
        className={`${styles.fill} ${colorClass}`} 
      />
    </div>
  );
};
