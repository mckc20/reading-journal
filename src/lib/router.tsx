import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppLayout from "@/components/AppLayout";

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Library = lazy(() => import("@/pages/Library"));
const Series = lazy(() => import("@/pages/Series"));
const SeriesDetails = lazy(() => import("@/pages/SeriesDetails"));
const SeriesJournal = lazy(() => import("@/pages/SeriesJournal"));
const SeriesAnalytics = lazy(() => import("@/pages/SeriesAnalytics"));
const SeriesBooks = lazy(() => import("@/pages/SeriesBooks"));
const SeriesQuotes = lazy(() => import("@/pages/SeriesQuotes"));
const ExploreLibrary = lazy(() => import("@/pages/ExploreLibrary"));
const Authors = lazy(() => import("@/pages/Authors"));
const AuthorsExplore = lazy(() => import("@/pages/AuthorsExplore"));
const AuthorDetails = lazy(() => import("@/pages/AuthorDetails"));
const AuthorJournal = lazy(() => import("@/pages/AuthorJournal"));
const AuthorBooks = lazy(() => import("@/pages/AuthorBooks"));
const AuthorQuotes = lazy(() => import("@/pages/AuthorQuotes"));
const Search = lazy(() => import("@/pages/Search"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Discover = lazy(() => import("@/pages/Discover"));
const ReadingHistory = lazy(() => import("@/pages/ReadingHistory"));
const WrapUps = lazy(() => import("@/pages/WrapUps"));
const LibraryJournal = lazy(() => import("@/pages/LibraryJournal"));
const JournalEntryRedirect = lazy(() => import("@/pages/JournalEntryRedirect"));
const Genres = lazy(() => import("@/pages/Genres"));
const GenreDetails = lazy(() => import("@/pages/GenreDetails"));
const BookDetails = lazy(() => import("@/pages/BookDetails"));
const BookAnalytics = lazy(() => import("@/pages/BookAnalytics"));
const BookAnnotations = lazy(() => import("@/pages/BookAnnotations"));
const Changelog = lazy(() => import("@/pages/Changelog"));
const Groups = lazy(() => import("@/pages/Groups"));
const Profile = lazy(() => import("@/pages/Profile"));
const Settings = lazy(() => import("@/pages/Settings"));

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

function RedirectTo({ to, preserveSearch = false }: { to: string; preserveSearch?: boolean }) {
  const location = useLocation();
  return <Navigate to={`${to}${preserveSearch ? location.search : ""}`} replace />;
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
          { path: "/library/books", element: lazyRoute(<ExploreLibrary />) },
          { path: "/library/authors", element: lazyRoute(<AuthorsExplore />) },
          { path: "/library/series", element: lazyRoute(<Series />) },
          { path: "/library/genres", element: lazyRoute(<Genres />) },
          { path: "/library/journal", element: lazyRoute(<LibraryJournal />) },
          { path: "/journal/:publicId", element: lazyRoute(<JournalEntryRedirect />) },
          { path: "/statistics", element: lazyRoute(<Analytics />) },
          { path: "/reading-history", element: lazyRoute(<ReadingHistory />) },
          { path: "/wrap-ups", element: lazyRoute(<WrapUps />) },
          { path: "/messages", element: lazyRoute(<Groups />) },
          { path: "/discover", element: lazyRoute(<Discover />) },
          { path: "/series", element: <Navigate to="/library/series" replace /> },
          { path: "/series/:seriesId", element: lazyRoute(<SeriesDetails />) },
          { path: "/series/:seriesId/journal", element: lazyRoute(<SeriesJournal />) },
          { path: "/series/:seriesId/analytics", element: lazyRoute(<SeriesAnalytics />) },
          { path: "/series/:seriesId/books", element: lazyRoute(<SeriesBooks />) },
          { path: "/series/:seriesId/quotes", element: lazyRoute(<SeriesQuotes />) },
          { path: "/library/explore", element: <RedirectTo to="/library/books" preserveSearch /> },
          { path: "/authors", element: lazyRoute(<Authors />) },
          { path: "/authors/explore", element: <RedirectTo to="/library/authors" preserveSearch /> },
          { path: "/authors/:authorId", element: lazyRoute(<AuthorDetails />) },
          { path: "/authors/:authorId/journal", element: lazyRoute(<AuthorJournal />) },
          { path: "/authors/:authorId/books", element: lazyRoute(<AuthorBooks />) },
          { path: "/authors/:authorId/quotes", element: lazyRoute(<AuthorQuotes />) },
          { path: "/search", element: lazyRoute(<Search />) },
          { path: "/genres", element: <Navigate to="/library/genres" replace /> },
          { path: "/genres/:genreId", element: lazyRoute(<GenreDetails />) },
          { path: "/books/:bookId", element: lazyRoute(<BookDetails />) },
          { path: "/books/:bookId/analytics", element: lazyRoute(<BookAnalytics />) },
          { path: "/books/:bookId/journal", element: lazyRoute(<BookAnnotations />) },
          { path: "/books/:bookId/annotations", element: lazyRoute(<BookAnnotations />) },
          { path: "/changelog", element: lazyRoute(<Changelog />) },
          { path: "/analytics", element: <Navigate to="/statistics" replace /> },
          { path: "/analytics/:category", element: <Navigate to="/statistics" replace /> },
          { path: "/account", element: <Navigate to="/settings/profile" replace /> },
          { path: "/chat", element: <Navigate to="/messages" replace /> },
          { path: "/group", element: <Navigate to="/messages" replace /> },
          { path: "/groups", element: <Navigate to="/messages" replace /> },
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
