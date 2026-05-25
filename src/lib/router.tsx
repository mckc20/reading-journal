import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Library = lazy(() => import("@/pages/Library"));
const Series = lazy(() => import("@/pages/Series"));
const SeriesDetails = lazy(() => import("@/pages/SeriesDetails"));
const ExploreLibrary = lazy(() => import("@/pages/ExploreLibrary"));
const Authors = lazy(() => import("@/pages/Authors"));
const AuthorDetails = lazy(() => import("@/pages/AuthorDetails"));
const Search = lazy(() => import("@/pages/Search"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const BookDetails = lazy(() => import("@/pages/BookDetails"));
const Groups = lazy(() => import("@/pages/Groups"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Shelves = lazy(() => import("@/pages/Shelves"));

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
          { path: "/series", element: lazyRoute(<Series />) },
          { path: "/series/:seriesId", element: lazyRoute(<SeriesDetails />) },
          { path: "/library/explore", element: lazyRoute(<ExploreLibrary />) },
          { path: "/authors", element: lazyRoute(<Authors />) },
          { path: "/authors/:authorName", element: lazyRoute(<AuthorDetails />) },
          { path: "/search", element: lazyRoute(<Search />) },
          { path: "/books/:bookId", element: lazyRoute(<BookDetails />) },
          { path: "/analytics", element: lazyRoute(<Analytics />) },
          { path: "/shelves", element: lazyRoute(<Shelves />) },
          { path: "/account", element: <Navigate to="/settings/profile" replace /> },
          { path: "/groups", element: lazyRoute(<Groups />) },
          { path: "/profile", element: lazyRoute(<Profile />) },
          { path: "/settings", element: lazyRoute(<Settings />) },
          { path: "/settings/:tab", element: lazyRoute(<Settings />) },
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
