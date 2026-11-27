import LoadingIndicator from "@/components/LoadingIndicator";
import { lazy, Suspense, type ComponentType, type ReactNode } from "react";
import { createBrowserRouter, Navigate, replace, useLocation, useParams } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import { bookJournalHref, entityJournalHref } from "@/lib/journalLinks";
import { wishlistCollectionPath } from "@/lib/libraryCollections";
import { legacyLibraryDestination, libraryAuthorFiltersPath } from "@/lib/libraryRedirects";
import { recommendationShelfPath } from "@/lib/recommendationIdentity";

// Load the signed-in app shell only after ProtectedRoute resolves the session.
const AppLayout = lazy(() => import("@/components/AppLayout"));

const Login = lazy(() => import("@/pages/Login"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const SeriesDetails = lazy(() => import("@/pages/SeriesDetails"));
const AuthorDetails = lazy(() => import("@/pages/AuthorDetails"));
const JournalEntryRedirect = lazy(() => import("@/pages/JournalEntryRedirect"));
const GenreDetails = lazy(() => import("@/pages/GenreDetails"));
const BookDetails = lazy(() => import("@/pages/BookDetails"));
const Changelog = lazy(() => import("@/pages/Changelog"));
const Help = lazy(() => import("@/pages/Help"));
const WrapUpsHelp = lazy(() => import("@/pages/WrapUpsHelp"));
const PublicProfile = lazy(() => import("@/pages/PublicProfile"));

function lazyRoute(element: ReactNode) {
  return <Suspense fallback={<LoadingIndicator variant="page" />}>{element}</Suspense>;
}

function pageRoute(path: string, load: () => Promise<{ default: ComponentType }>) {
  // Load the next page before the router captures its view-transition snapshot.
  return { path, lazy: async () => ({ Component: (await load()).default }) };
}

function NotFound() {
  return (
    <div className="p-4">
      <h1 className="text-xl font-heading leading-snug font-medium">404 — Page Not Found</h1>
    </div>
  );
}

function RedirectLegacyLibrary({ browseBy }: { browseBy?: "author" | "genre" }) {
  const { search } = useLocation();
  return <Navigate to={legacyLibraryDestination(search, browseBy)} replace />;
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
  const collection = entity === "author" ? libraryAuthorFiltersPath : "/library/series";
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
    hydrateFallbackElement: <LoadingIndicator variant="page" />,
    children: [
      {
        element: lazyRoute(<AppLayout />),
        children: [
          pageRoute("/", () => import("@/pages/Dashboard")),
          {
            path: "/library",
            lazy: async () => ({ Component: (await import("@/components/redesign/LibraryNavigation")).LibraryLayoutRoute }),
            hydrateFallbackElement: <LoadingIndicator variant="page" />,
            // Resolve the next tab before swapping out the current panel.
            children: [
              { index: true, lazy: async () => ({ Component: (await import("@/pages/Library")).default }) },
              {
                path: "collections",
                loader: ({ request }) => {
                  const params = new URL(request.url).searchParams;
                  if (params.get("collection") !== "Finished") return null;
                  params.delete("collection");
                  params.set("status", "Finished");
                  return replace(`/library?${params}`);
                },
                lazy: async () => ({ Component: (await import("@/pages/LibraryCollections")).default }),
              },
              { path: "series", lazy: async () => ({ Component: (await import("@/pages/Series")).default }) },
            ],
          },
          { path: "/library/wishlist", element: <Navigate to={wishlistCollectionPath} replace /> },
          { path: "/library/books", element: <RedirectLegacyLibrary /> },
          { path: "/library/authors", element: <RedirectLegacyLibrary browseBy="author" /> },
          { path: "/library/genres", element: <RedirectLegacyLibrary browseBy="genre" /> },
          { path: "/library/genres/all", element: <RedirectLegacyLibrary browseBy="genre" /> },
          pageRoute("/library/journal", () => import("@/pages/LibraryJournal")),
          { path: "/journal/:publicId", element: lazyRoute(<JournalEntryRedirect />) },
          pageRoute("/statistics", () => import("@/pages/Analytics")),
          pageRoute("/reading-history", () => import("@/pages/ReadingHistory")),
          pageRoute("/wrap-ups", () => import("@/pages/WrapUps")),
          pageRoute("/wrap-ups/:monthKey", () => import("@/pages/WrapUps")),
          pageRoute("/messages", () => import("@/pages/Groups")),
          { path: "/discover/recommendations", element: <Navigate to={recommendationShelfPath} replace /> },
          { path: "/recommendations", element: <Navigate to={recommendationShelfPath} replace /> },
          { path: "/discover", element: <Navigate to={recommendationShelfPath} replace /> },
          { path: "/series", element: <Navigate to="/library/series" replace /> },
          { path: "/series/:seriesId", element: lazyRoute(<SeriesDetails />) },
          { path: "/series/:seriesId/journal", element: <RedirectEntityDetail entity="series" section="journal" /> },
          { path: "/series/:seriesId/analytics", element: <RedirectEntityDetail entity="series" section="insights" /> },
          { path: "/series/:seriesId/books", element: <RedirectEntityDetail entity="series" section="books" /> },
          { path: "/series/:seriesId/quotes", element: <RedirectEntityDetail entity="series" section="journal" /> },
          { path: "/library/explore", element: <RedirectLegacyLibrary /> },
          { path: "/authors", element: <RedirectLegacyLibrary browseBy="author" /> },
          { path: "/authors/explore", element: <RedirectLegacyLibrary browseBy="author" /> },
          { path: "/authors/:authorId", element: lazyRoute(<AuthorDetails />) },
          { path: "/authors/:authorId/journal", element: <RedirectEntityDetail entity="author" section="journal" /> },
          { path: "/authors/:authorId/books", element: <RedirectEntityDetail entity="author" section="books" /> },
          { path: "/authors/:authorId/quotes", element: <RedirectEntityDetail entity="author" section="journal" /> },
          { path: "/search", element: <RedirectLegacyLibrary /> },
          { path: "/genres", element: <RedirectLegacyLibrary browseBy="genre" /> },
          { path: "/genres/:genreId", element: lazyRoute(<GenreDetails />) },
          { path: "/books/:bookId", element: lazyRoute(<BookDetails />) },
          pageRoute("/books/recommendation/:candidateKey", () => import("@/pages/RecommendationDetails")),
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
          pageRoute("/profile", () => import("@/pages/Profile")),
          { path: "/profiles/:profileId", element: lazyRoute(<PublicProfile />) },
          pageRoute("/settings", () => import("@/pages/Settings")),
          pageRoute("/settings/:tab", () => import("@/pages/Settings")),
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
