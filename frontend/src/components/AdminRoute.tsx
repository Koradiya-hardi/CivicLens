import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

/**
 * Stacks on top of ProtectedRoute's job: that one confirms "logged in at
 * all", this one additionally confirms "specifically an admin" - mirrors
 * the backend's protect + authorize("admin") pairing from Week 1.
 * Non-admins get sent to the chat page rather than /login, since they
 * ARE logged in - they're just not allowed on this specific page.
 */
export function AdminRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}