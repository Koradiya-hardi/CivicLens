import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminRoute } from "@/components/AdminRoute";
import { AppLayout } from "@/components/AppLayout";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import ChatPage from "@/pages/ChatPage";
import LibraryPage from "@/pages/LibraryPage";
import UploadPage from "@/pages/UploadPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminOverviewPage from "@/pages/admin/AdminOverviewPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminDocumentsPage from "@/pages/admin/AdminDocumentsPage";
import AdminHealthPage from "@/pages/admin/AdminHealthPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Week 5: the dashboard is now home; chat moved to /chat */}
        <Route index element={<DashboardPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="library" element={<LibraryPage />} />
        <Route
          path="upload"
          element={
            <AdminRoute>
              <UploadPage />
            </AdminRoute>
          }
        />

        {/* Week 6: admin panel. AdminRoute guards the whole subtree; the API
            enforces the same rule server-side, so this is convenience, not security. */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminOverviewPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="documents" element={<AdminDocumentsPage />} />
          <Route path="health" element={<AdminHealthPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
