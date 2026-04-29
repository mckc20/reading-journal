import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Plus,
  LayoutDashboard,
  Library,
  Search,
  BarChart3,
  Users,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { BooksProvider } from "@/context/BooksContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { useAuth, useProfile } from "@/context";
import { cn } from "@/lib/utils";
import readingJournalLogo from "@/assets/reading-journal-logo.png";

const AddBookDialog = lazy(() => import("./AddBookDialog"));

const navLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/library", label: "Library", icon: Library },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
];

function getDisplayName(
  profile: ReturnType<typeof useProfile>["profile"],
  email?: string | null,
): string {
  const name = [profile?.first_name, profile?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return name || email || "Profile";
}

function getSettingsPath(): string {
  if (typeof window === "undefined") return "/settings/profile";
  return window.matchMedia("(min-width: 768px)").matches ? "/settings/profile" : "/settings";
}

function AppLayoutContent() {
  const { signOut, user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const displayName = getDisplayName(profile, user?.email);

  useEffect(() => {
    if (!avatarMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setAvatarMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [avatarMenuOpen]);

  function navigateFromAvatarMenu(path: string) {
    setAvatarMenuOpen(false);
    navigate(path);
  }

  async function signOutFromAvatarMenu() {
    setAvatarMenuOpen(false);
    await signOut();
  }

  return (
    <>
      <div className="min-h-svh flex flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
            {/* Logo / app name */}
            <Link
              to="/"
              className="flex items-center gap-2 font-semibold text-foreground"
            >
              <img
                src={readingJournalLogo}
                alt="Reading Journal logo"
                className="h-6 w-6 rounded-sm object-cover dark:brightness-0 dark:invert"
              />
              <span className="hidden sm:inline">Reading Journal</span>
            </Link>

            {/* Desktop nav links */}
            <nav className="hidden md:flex items-center gap-1 ml-2">
              {navLinks.map(({ to, label }) => {
                const active =
                  to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>

            <div className="ml-auto flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setAddBookOpen(true)}
                aria-label="Add book"
              >
                <Plus className="h-5 w-5" />
              </Button>
              <Button size="icon" variant="ghost" asChild>
                <Link to="/search" aria-label="Search">
                  <Search className="h-5 w-5" />
                </Link>
              </Button>
              <Button size="icon" variant="ghost" aria-label="Groups" title="Groups" asChild>
                <Link to="/groups">
                  <Users className="h-5 w-5" />
                </Link>
              </Button>
              <div className="relative" ref={dropdownRef}>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full"
                  onClick={() => setAvatarMenuOpen((open) => !open)}
                  aria-label="Open profile menu"
                  aria-haspopup="menu"
                  aria-expanded={avatarMenuOpen}
                >
                  <ProfileAvatar profile={profile} email={user?.email} className="h-7 w-7 text-xs" />
                </Button>
                {avatarMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-lg"
                  >
                    <div className="border-b px-3 py-2">
                      <p className="truncate text-sm font-medium">{displayName}</p>
                      {user?.email && (
                        <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => navigateFromAvatarMenu("/profile")}
                    >
                      Profile
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => navigateFromAvatarMenu(getSettingsPath())}
                    >
                      Settings
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => void signOutFromAvatarMenu()}
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6 pb-20 md:pb-6">
          <Outlet />
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t bg-background md:hidden">
          {navLinks.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                  active
                    ? "text-foreground font-medium"
                    : "text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <Suspense fallback={null}>
        {addBookOpen && (
          <AddBookDialog open={addBookOpen} onOpenChange={setAddBookOpen} />
        )}
      </Suspense>
    </>
  );
}

export default function AppLayout() {
  return (
    <BooksProvider>
      <ProfileProvider>
        <AppLayoutContent />
      </ProfileProvider>
    </BooksProvider>
  );
}
