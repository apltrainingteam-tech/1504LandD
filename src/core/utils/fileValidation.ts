export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export const validateFileSize = (file?: File): { ok: boolean; reason?: string } => {
  if (!file) return { ok: false, reason: 'No file provided' };
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const mb = Math.round((file.size / (1024 * 1024)) * 10) / 10;
    return { ok: false, reason: `File too large (${mb} MB). Max ${MAX_UPLOAD_SIZE_BYTES / (1024 * 1024)} MB.` };
  }
  return { ok: true };
};

export default validateFileSize;

