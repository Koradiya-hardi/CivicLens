const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001/api";

/**
 * Uploaded files are served from the backend's root (/uploads/...), not from
 * under /api, so we take just the origin of the API URL.
 */
export const fileHref = (fileUrl: string): string => `${new URL(API_URL).origin}${fileUrl}`;