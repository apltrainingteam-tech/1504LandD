import React, { useState, useRef } from 'react';
import { Upload, Users, CheckCircle2 } from 'lucide-react';
import styles from './AvatarUpload.module.css';

interface AvatarUploadProps {
  value?: string;
  onChange: (file: File | null) => void;
  trainerCode?: string;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({ value, onChange, trainerCode }) => {
  const [preview, setPreview] = useState(value);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) return alert("File too large (max 2MB)");
      if (!file.type.startsWith("image/")) return alert("Only images allowed");
      
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
      onChange(file);
    }
  };

  return (
    <div className={styles.avatarUploadContainer}>
      <div 
        className={styles.avatarPreview} 
        style={{ backgroundImage: preview ? `url(${preview})` : 'none' }}
        onClick={() => fileInputRef.current?.click()}
      >
        {!preview && (
          <div className={styles.avatarFallback}>
            {trainerCode || <Users size={24} color="var(--text-muted)" />}
          </div>
        )}
      </div>
      <div className={styles.avatarControls}>
        <button 
          type="button" 
          className={`btn ${preview !== value ? 'btn-success' : 'btn-secondary'} btn-sm`} 
          onClick={() => fileInputRef.current?.click()}
        >
          {preview !== value ? (
            <><CheckCircle2 size={14} className="mr-2" /> Selected</>
          ) : (
            <><Upload size={14} className="mr-2" /> Upload Avatar</>
          )}
        </button>
        <p className={styles.uploadHint}>Max 2MB. JPG/PNG.</p>
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        className={styles.hiddenInput} 
        accept="image/*"
        title="Upload avatar file"
        aria-label="Upload avatar file"
        onChange={handleFileChange} 
      />
    </div>
  );
};
