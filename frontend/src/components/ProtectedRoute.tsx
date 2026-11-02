import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Wraps any page that should require login, e.g.:
 *   <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
 *
 * Three possible states, handled in order:
 *   1. Still checking (loading) - render nothing yet, rather than
 *      flashing a redirect to /login before we've even confirmed the
 *      stored token is invalid.
 *   2. Confirmed not logged in - redirect to /login. `replace` means this
 *      doesn't add a new browser history entry, so hitting "back" doesn't
 *      bounce the user between the protected page and /login forever.
 *   3. Logged in - render the actual page.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}