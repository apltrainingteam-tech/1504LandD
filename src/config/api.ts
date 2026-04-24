const API_BASE = import.meta.env.VITE_API_URL;

if (!API_BASE) {
  console.error("CRITICAL ERROR: VITE_API_URL is not defined!");
  throw new Error("VITE_API_URL is not defined");
}

if (API_BASE.includes("vercel.app")) {
  console.error("CRITICAL ERROR: API_BASE includes vercel.app!", API_BASE);
  throw new Error("Invalid API base URL: pointing to frontend domain");
}

// Runtime debug logging
console.log("FINAL API BASE:", API_BASE);

export default API_BASE;
