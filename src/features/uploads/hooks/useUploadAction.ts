import { useState, useRef, useCallback } from 'react';
import { uploadTrainingDataStrict, validateFile, UploadProgress, UploadResult } from '../../../core/engines/uploadEngine';
import { ParseResult, getValidRows, getErrorRows } from '../../../core/engines/parsingEngine';
import { addBatch } from '../../../core/engines/apiClient';

export const useUploadAction = (onUploadComplete?: () => void) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'uploading' | 'done'>('upload');
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({
    stage: 'parsing',
    processed: 0,
    total: 100,
    message: 'Ready to upload'
  });
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [previewResult, setPreviewResult] = useState<ParseResult | null>(null);
  const uploadMode: 'append' = 'append';
  
  const isMountedRef = useRef(true);

  const startValidation = useCallback(async (file: File) => {
    setStep('uploading');
    setUploadProgress({
      stage: 'parsing',
      processed: 30,
      total: 100,
      message: 'Validating file...'
    });

    try {
      const result = await validateFile(file);
      if (isMountedRef.current) {
        setPreviewResult(result);
        setStep('preview');
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        alert(`Validation failed: ${err.message}`);
        setStep('upload');
      }
    }
  }, []);

  const confirmUpload = useCallback(async (file: File) => {
    setStep('uploading');
    setUploadResult(null);
    setUploadProgress({
      stage: 'parsing',
      processed: 0,
      total: 100,
      message: 'Starting upload process...'
    });

    try {
      const result = await uploadTrainingDataStrict(file, {
        mode: 'append',
        onProgress: (progress) => {
          if (isMountedRef.current) {
            setUploadProgress(progress);
          }
        }
      });

      if (isMountedRef.current) {
        setUploadResult(result);
        setStep('done');
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        const errorMsg = err?.message || 'Upload failed';
        setUploadResult({
          success: false,
          templateType: 'UNKNOWN',
          totalRows: 0,
          uploadedRows: 0,
          rejectedRows: 0,
          activeEmployees: 0,
          inactiveEmployees: 0,
          errors: [{ rowNum: 0, message: errorMsg }],
          warnings: [],
          debugLog: errorMsg
        });
        setStep('done');
      }
    }
  }, [uploadMode, onUploadComplete]);


  const testInsert = useCallback(async () => {
    try {
      const testRecord = {
        _id: `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId: 'TEST-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
        attendanceDate: new Date().toISOString().split('T')[0],
        trainingType: 'TEST',
        score: 99,
        testRecord: true,
        uploadedAt: new Date().toISOString(),
        note: 'Database connectivity test - can safely delete'
      };
      await addBatch('training_data', [testRecord]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }, []);

  return {
    step,
    setStep,
    uploadProgress,
    uploadResult,
    uploadMode,
    previewResult,
    startValidation,
    confirmUpload,
    testInsert,
    setUploadResult,
    setUploadProgress
  };
};

