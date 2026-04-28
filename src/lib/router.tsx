import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Library = lazy(() => import("@/pages/Library"));
const Search = lazy(() => import("@/pages/Search"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const BookDetails = lazy(() => import("@/pages/BookDetails"));
const Account = lazy(() => import("@/pages/Account"));

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={null}>{element}</Suspense>;
}

function NotFound() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-heading leading-snug font-medium">404 — Page Not Found</h1>
    </div>
  );
}

export const router = createBrowserRouter([
  // Public route — no auth required
  {
    path: "/login",
    element: lazyRoute(<Login />),
  },

  // Protected layout: ProtectedRoute → AppLayout → page
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: lazyRoute(<Dashboard />) },
          { path: "/library", element: lazyRoute(<Library />) },
          { path: "/search", element: lazyRoute(<Search />) },
          { path: "/books/:bookId", element: lazyRoute(<BookDetails />) },
          { path: "/analytics", element: lazyRoute(<Analytics />) },
          { path: "/account", element: lazyRoute(<Account />) },
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
