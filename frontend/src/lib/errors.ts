import axios from "axios";

/**
 * Turns whatever a failed request threw into a sentence for the screen.
 * The backend's own message ("You can't delete your own account here.") is
 * preferred because it explains the real reason; a network failure gets a
 * friendly fallback instead of "Network Error".
 */
export const errorMessage = (err: unknown, fallback = "Something went wrong. Please try again."): string => {
  if (axios.isAxiosError(err)) {
    const serverMessage = (err.response?.data as { message?: string } | undefined)?.message;
    if (serverMessage) return serverMessage;
    if (!err.response) return "Can't reach the server. Check that the backend is running.";
    if (err.response.status === 429) return "Too many requests - wait a moment and try again.";
    if (err.response.status === 401) return "Your session expired. Please sign in again.";
  }
  return fallback;
};
