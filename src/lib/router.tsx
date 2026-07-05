import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Library = lazy(() => import("@/pages/Library"));
const Series = lazy(() => import("@/pages/Series"));
const SeriesDetails = lazy(() => import("@/pages/SeriesDetails"));
const SeriesAnalytics = lazy(() => import("@/pages/SeriesAnalytics"));
const SeriesBooks = lazy(() => import("@/pages/SeriesBooks"));
const SeriesQuotes = lazy(() => import("@/pages/SeriesQuotes"));
const ExploreLibrary = lazy(() => import("@/pages/ExploreLibrary"));
const Authors = lazy(() => import("@/pages/Authors"));
const AuthorsExplore = lazy(() => import("@/pages/AuthorsExplore"));
const AuthorDetails = lazy(() => import("@/pages/AuthorDetails"));
const AuthorBooks = lazy(() => import("@/pages/AuthorBooks"));
const AuthorQuotes = lazy(() => import("@/pages/AuthorQuotes"));
const Search = lazy(() => import("@/pages/Search"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Genres = lazy(() => import("@/pages/Genres"));
const GenreDetails = lazy(() => import("@/pages/GenreDetails"));
const BookDetails = lazy(() => import("@/pages/BookDetails"));
const BookAnalytics = lazy(() => import("@/pages/BookAnalytics"));
const BookAnnotations = lazy(() => import("@/pages/BookAnnotations"));
const Changelog = lazy(() => import("@/pages/Changelog"));
const Groups = lazy(() => import("@/pages/Groups"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));
const Notes = lazy(() => import("@/pages/Notes"));

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
          { path: "/series/:seriesId/analytics", element: lazyRoute(<SeriesAnalytics />) },
          { path: "/series/:seriesId/books", element: lazyRoute(<SeriesBooks />) },
          { path: "/series/:seriesId/quotes", element: lazyRoute(<SeriesQuotes />) },
          { path: "/library/explore", element: lazyRoute(<ExploreLibrary />) },
          { path: "/authors", element: lazyRoute(<Authors />) },
          { path: "/authors/explore", element: lazyRoute(<AuthorsExplore />) },
          { path: "/authors/:authorId", element: lazyRoute(<AuthorDetails />) },
          { path: "/authors/:authorId/books", element: lazyRoute(<AuthorBooks />) },
          { path: "/authors/:authorId/quotes", element: lazyRoute(<AuthorQuotes />) },
          { path: "/search", element: lazyRoute(<Search />) },
          { path: "/genres", element: lazyRoute(<Genres />) },
          { path: "/genres/:genreId", element: lazyRoute(<GenreDetails />) },
          { path: "/books/:bookId", element: lazyRoute(<BookDetails />) },
          { path: "/books/:bookId/analytics", element: lazyRoute(<BookAnalytics />) },
          { path: "/books/:bookId/annotations", element: lazyRoute(<BookAnnotations />) },
          { path: "/changelog", element: lazyRoute(<Changelog />) },
          { path: "/discover", element: lazyRoute(<Analytics />) },
          { path: "/analytics", element: lazyRoute(<Analytics />) },
          { path: "/analytics/:category", element: lazyRoute(<Analytics />) },
          { path: "/notes", element: lazyRoute(<Notes />) },
          { path: "/account", element: <Navigate to="/settings/profile" replace /> },
          { path: "/group", element: <Navigate to="/groups" replace /> },
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
