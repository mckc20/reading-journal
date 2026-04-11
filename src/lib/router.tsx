import { createBrowserRouter } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Library from "@/pages/Library";

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

  // Protected layout: ProtectedRoute → AppLayout → page
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Dashboard /> },
          { path: "/library", element: <Library /> },
        ],
      },
    ],
  },

  // 404 — outside protected wrapper intentionally
  {
    path: "*",
    element: <NotFound />,
  },
]);
