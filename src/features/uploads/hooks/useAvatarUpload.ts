import { uploadAvatar } from '../../../core/engines/apiClient';

export const useAvatarUpload = () => {
  const handleUpload = async (file: File) => {
    // 1. File Validation
    if (!file.type.startsWith("image/")) {
      throw new Error("Invalid file type. Please upload an image.");
    }

    // 2. Size Limit (2MB)
    if (file.size > 2 * 1024 * 1024) {
      throw new Error("File too large. Maximum size is 2MB.");
    }

    return await uploadAvatar(file);
  };

  return { handleUpload };
};
