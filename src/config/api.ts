/**
 * Centralized API Base URL
 * Points to the Render production backend.
 */
export const API_BASE = import.meta.env.VITE_API_URL || "https://one504landd.onrender.com/api";

// Build-safety check – visible in both dev console and Vercel Function logs
console.log("FINAL API BASE:", API_BASE);
console.log("ENV MODE:", import.meta.env.MODE);
