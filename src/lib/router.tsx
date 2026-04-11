import { createBrowserRouter } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Login from "@/pages/Login";

// Stub components — replaced with real page imports in Phase 3
function Dashboard() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Dashboard</h1>
    </div>
  );
}

function Library() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">Library</h1>
    </div>
  );
}

function NotFound() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-semibold">404 — Page Not Found</h1>
    </div>
  );
}

export const router = createBrowserRouter([
  // Public route — no auth required
  {
    path: "/login",
    element: <Login />,
  },

  // Protected layout — ProtectedRoute wraps all children via <Outlet />
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <Dashboard /> },
      { path: "/library", element: <Library /> },
    ],
  },

  // 404 — outside protected wrapper intentionally
  {
    path: "*",
    element: <NotFound />,
  },
]);
