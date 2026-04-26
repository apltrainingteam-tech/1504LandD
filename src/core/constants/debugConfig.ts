export const DEBUG_MODE = process.env.NODE_ENV !== "production";
export const TRACE_ENABLED = DEBUG_MODE && true;
export const SNAPSHOT_ENABLED = DEBUG_MODE && true;
