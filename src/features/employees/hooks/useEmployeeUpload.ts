import { useState } from 'react';
import { parseEmployeeMasterExcel, ParsedRow } from '../../../core/engines/parsingEngine';
import { addBatch } from '../../../core/engines/apiClient';

export const useEmployeeUpload = (onUploadComplete?: () => void) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const performUpload = async (rows: ParsedRow[]) => {
    setUploading(true);
    setUploadProgress(0);
    try {
      const uploadable = rows.filter(r => r.status !== 'error').map(r => r.data);
      const total = uploadable.length;
      
      // Batch upload progressively
      const chunkSize = 50; 
      for (let i = 0; i < total; i += chunkSize) {
         const chunk = uploadable.slice(i, i + chunkSize);
         await addBatch('employees', chunk);
         setUploadProgress(Math.round(((i + chunk.length) / total) * 100));
      }
      
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      setUploading(false);
    }
  };

  const parseFile = async (file: File) => {
    try {
      const { rows: processed } = await parseEmployeeMasterExcel(file);
      return { success: true, rows: processed };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return {
    uploading,
    uploadProgress,
    performUpload,
    parseFile
  };
};
