/**
 * Centralized API Base URL
 *
 * DEV  → http://localhost:5000/api           (VITE_API_URL not set)
 * PROD → https://1504-land-d-delta.vercel.app/api  (via VITE_API_URL on Vercel)
 *
 * Vercel: Settings → Environment Variables
 *   VITE_API_URL = https://1504-land-d-delta.vercel.app/api
 */
export const API_BASE =
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Build-safety check – visible in both dev console and Vercel Function logs
console.log("ENV MODE:", import.meta.env.MODE);
console.log("API BASE:", API_BASE);
