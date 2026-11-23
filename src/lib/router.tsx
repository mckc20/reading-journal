import LoadingIndicator from "@/components/LoadingIndicator";
import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate, useLocation, useParams } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { bookJournalHref, entityJournalHref } from "@/lib/journalLinks";

// Load the signed-in app shell only after ProtectedRoute resolves the session.
const AppLayout = lazy(() => import("@/components/AppLayout"));

const Login = lazy(() => import("@/pages/Login"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Library = lazy(() => import("@/pages/Library"));
const Wishlist = lazy(() => import("@/pages/Wishlist"));
const Series = lazy(() => import("@/pages/Series"));
const SeriesDetails = lazy(() => import("@/pages/SeriesDetails"));
const ExploreLibrary = lazy(() => import("@/pages/ExploreLibrary"));
const Authors = lazy(() => import("@/pages/Authors"));
const AuthorsExplore = lazy(() => import("@/pages/AuthorsExplore"));
const AuthorDetails = lazy(() => import("@/pages/AuthorDetails"));
const Search = lazy(() => import("@/pages/Search"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Discover = lazy(() => import("@/pages/Discover"));
const ReadingHistory = lazy(() => import("@/pages/ReadingHistory"));
const WrapUps = lazy(() => import("@/pages/WrapUps"));
const LibraryJournal = lazy(() => import("@/pages/LibraryJournal"));
const JournalEntryRedirect = lazy(() => import("@/pages/JournalEntryRedirect"));
const Genres = lazy(() => import("@/pages/Genres"));
const AllGenres = lazy(() => import("@/pages/AllGenres"));
const GenreDetails = lazy(() => import("@/pages/GenreDetails"));
const BookDetails = lazy(() => import("@/pages/BookDetails"));
const Changelog = lazy(() => import("@/pages/Changelog"));
const Help = lazy(() => import("@/pages/Help"));
const WrapUpsHelp = lazy(() => import("@/pages/WrapUpsHelp"));
const Groups = lazy(() => import("@/pages/Groups"));
const Profile = lazy(() => import("@/pages/Profile"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));
const Settings = lazy(() => import("@/pages/Settings"));

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<LoadingIndicator variant="page" />}>{element}</Suspense>;
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

function RedirectBookJournal() {
  const { bookId } = useParams<{ bookId: string }>();
  const { search } = useLocation();
  return <Navigate to={bookId ? bookJournalHref(bookId, new URLSearchParams(search)) : "/library"} replace />;
}

function RedirectEntityDetail({ entity, section }: {
  entity: "author" | "series";
  section: "books" | "journal" | "insights";
}) {
  const { authorId, seriesId } = useParams();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const id = entity === "author" ? authorId : seriesId;
  const collection = entity === "author" ? "/authors" : "/library/series";
  if (!id) return <Navigate to={collection} replace />;
  if (section === "journal") return <Navigate to={entityJournalHref(entity, id, params)} replace />;

  if (section === "books") {
    params.delete("display");
    if (params.get("sort") === "chronological-order") params.set("sort", "volume");
  }
  const path = `/${entity === "author" ? "authors" : "series"}/${encodeURIComponent(id)}`;
  return <Navigate to={`${path}${params.size ? `?${params}` : ""}#${section}`} replace />;
}

export const router = createBrowserRouter([
  // Public route — no auth required
  {
    path: "/login",
    element: lazyRoute(<Login />),
  },
  {
    path: "/reset-password",
    element: lazyRoute(<ResetPassword />),
  },

  // Protected layout: ProtectedRoute → AppLayout → page
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: lazyRoute(<AppLayout />),
        children: [
          { path: "/", element: lazyRoute(<Dashboard />) },
          { path: "/library", element: lazyRoute(<Library />) },
          { path: "/library/wishlist", element: lazyRoute(<Wishlist />) },
          { path: "/library/books", element: lazyRoute(<ExploreLibrary />) },
          { path: "/library/authors", element: lazyRoute(<AuthorsExplore />) },
          { path: "/library/series", element: lazyRoute(<Series />) },
          { path: "/library/genres", element: lazyRoute(<Genres />) },
          { path: "/library/genres/all", element: lazyRoute(<AllGenres />) },
          { path: "/library/journal", element: lazyRoute(<LibraryJournal />) },
          { path: "/journal/:publicId", element: lazyRoute(<JournalEntryRedirect />) },
          { path: "/statistics", element: lazyRoute(<Analytics />) },
          { path: "/reading-history", element: lazyRoute(<ReadingHistory />) },
          { path: "/wrap-ups", element: lazyRoute(<WrapUps />) },
          { path: "/wrap-ups/:monthKey", element: lazyRoute(<WrapUps />) },
          { path: "/messages", element: lazyRoute(<Groups />) },
          { path: "/discover/recommendations", element: lazyRoute(<Discover />) },
          { path: "/discover", element: lazyRoute(<Discover />) },
          { path: "/series", element: <Navigate to="/library/series" replace /> },
          { path: "/series/:seriesId", element: lazyRoute(<SeriesDetails />) },
          { path: "/series/:seriesId/journal", element: <RedirectEntityDetail entity="series" section="journal" /> },
          { path: "/series/:seriesId/analytics", element: <RedirectEntityDetail entity="series" section="insights" /> },
          { path: "/series/:seriesId/books", element: <RedirectEntityDetail entity="series" section="books" /> },
          { path: "/series/:seriesId/quotes", element: <RedirectEntityDetail entity="series" section="journal" /> },
          { path: "/library/explore", element: <RedirectTo to="/library/books" preserveSearch /> },
          { path: "/authors", element: lazyRoute(<Authors />) },
          { path: "/authors/explore", element: <RedirectTo to="/library/authors" preserveSearch /> },
          { path: "/authors/:authorId", element: lazyRoute(<AuthorDetails />) },
          { path: "/authors/:authorId/journal", element: <RedirectEntityDetail entity="author" section="journal" /> },
          { path: "/authors/:authorId/books", element: <RedirectEntityDetail entity="author" section="books" /> },
          { path: "/authors/:authorId/quotes", element: <RedirectEntityDetail entity="author" section="journal" /> },
          { path: "/search", element: lazyRoute(<Search />) },
          { path: "/genres", element: <Navigate to="/library/genres" replace /> },
          { path: "/genres/:genreId", element: lazyRoute(<GenreDetails />) },
          { path: "/books/:bookId", element: lazyRoute(<BookDetails />) },
          { path: "/books/:bookId/analytics", element: <Navigate to=".." relative="path" replace /> },
          { path: "/books/:bookId/journal", element: <RedirectBookJournal /> },
          { path: "/books/:bookId/annotations", element: <RedirectBookJournal /> },
          { path: "/changelog", element: lazyRoute(<Changelog />) },
          { path: "/help", element: lazyRoute(<Help />) },
          { path: "/help/wrap-ups", element: lazyRoute(<WrapUpsHelp />) },
          { path: "/analytics", element: <Navigate to="/statistics" replace /> },
          { path: "/analytics/:category", element: <Navigate to="/statistics" replace /> },
          { path: "/account", element: <Navigate to="/settings/profile" replace /> },
          { path: "/chat", element: <Navigate to="/messages" replace /> },
          { path: "/group", element: <Navigate to="/messages" replace /> },
          { path: "/groups", element: <Navigate to="/messages" replace /> },
          { path: "/profile", element: lazyRoute(<Profile />) },
          { path: "/profiles/:profileId", element: lazyRoute(<PublicProfile />) },
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
