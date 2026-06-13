import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BookOpen,
  Compass,
  Home,
  Library,
  LogOut,
  Plus,
  Search,
  Settings,
  StickyNote,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { BooksProvider } from "@/context/BooksContext";
import { GenresProvider } from "@/context/GenresContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { useAuth, useProfile } from "@/context";
import { cn } from "@/lib/utils";

const AddBookDialog = lazy(() => import("./AddBookDialog"));

type NavLink = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const primaryNavLinks: NavLink[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/library", label: "Books", icon: Library },
  { to: "/authors", label: "Authors", icon: UserRound },
  { to: "/analytics", label: "Discover", icon: Compass },
  { to: "/notes", label: "Notes", icon: StickyNote },
];

function isActiveRoute(pathname: string, search: string, to: string): boolean {
  const [targetPathname, targetSearch = ""] = to.split("?");

  if (targetPathname === "/") return pathname === "/";
  if (pathname !== targetPathname && !pathname.startsWith(`${targetPathname}/`)) {
    return false;
  }

  const targetParams = new URLSearchParams(targetSearch);
  const targetView = targetParams.get("view");

  if (!targetView) return pathname === targetPathname;

  const currentParams = new URLSearchParams(search);
  const currentView = currentParams.get("view") ?? "all";
  return currentView === targetView;
}

function getDisplayName(
  profile: ReturnType<typeof useProfile>["profile"],
  email?: string | null,
): string {
  if (profile?.display_name?.trim()) return profile.display_name.trim();

  const name = [profile?.first_name, profile?.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  return name || email || "Profile";
}

function AppLayoutContent() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const [addBookOpen, setAddBookOpen] = useState(false);
  const displayName = getDisplayName(profile, user?.email);

  return (
    <>
      <div className="min-h-svh bg-background text-foreground">
        <AppHeader
          pathname={location.pathname}
          search={location.search}
          profile={profile}
          email={user?.email}
          displayName={displayName}
          onSignOut={signOut}
        />

        <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-5 pb-28 sm:px-8 md:px-10 md:py-8 lg:px-12">
          <Outlet context={{ onAddBookClick: () => setAddBookOpen(true) }} />
        </main>

        <FloatingAddBookButton onClick={() => setAddBookOpen(true)} />
        <MobileBottomNav pathname={location.pathname} search={location.search} />
      </div>

      <Suspense fallback={null}>
        {addBookOpen && (
          <AddBookDialog open={addBookOpen} onOpenChange={setAddBookOpen} />
        )}
      </Suspense>
    </>
  );
}

function AppHeader({
  pathname,
  search,
  profile,
  email,
  displayName,
  onSignOut,
}: {
  pathname: string;
  search: string;
  profile: ReturnType<typeof useProfile>["profile"];
  email?: string | null;
  displayName: string;
  onSignOut: () => Promise<void>;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-10 lg:px-12">
        <Link
          to="/"
          className="flex min-w-0 items-center gap-3 font-heading font-medium text-foreground"
          aria-label="Reading Journal home"
        >
          <BookOpen className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate text-base">Reading Journal</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Primary navigation">
          {primaryNavLinks.map((link) => (
            <TopNavLink
              key={link.to}
              link={link}
              active={isActiveRoute(pathname, search, link.to)}
            />
          ))}
        </nav>

        <div className="flex min-w-0 items-center justify-end gap-1">
          <Button size="icon" variant="ghost" asChild>
            <Link to="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          <Button size="icon" variant="ghost" asChild>
            <Link to="/groups" aria-label="Groups">
              <Users className="h-5 w-5" />
            </Link>
          </Button>
          <ProfileMenu
            profile={profile}
            email={email}
            displayName={displayName}
            onSignOut={onSignOut}
          />
        </div>
      </div>
    </header>
  );
}

function TopNavLink({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      to={link.to}
      className={cn(
        "relative px-4 py-5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        active && "text-foreground after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary",
      )}
    >
      {link.label}
    </Link>
  );
}

function ProfileMenu({
  profile,
  email,
  displayName,
  onSignOut,
}: {
  profile: ReturnType<typeof useProfile>["profile"];
  email?: string | null;
  displayName: string;
  onSignOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await onSignOut();
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        className="flex rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
        aria-label={`Open profile menu for ${displayName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <ProfileAvatar profile={profile} email={email} className="h-9 w-9 text-sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-48 rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-[var(--shadow-popover)]"
        >
          <ProfileMenuLink to="/profile" icon={UserRound} label="Profile" onSelect={() => setOpen(false)} />
          <ProfileMenuLink to="/settings/profile" icon={Settings} label="Settings" onSelect={() => setOpen(false)} />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
            onClick={() => void handleSignOut()}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function ProfileMenuLink({
  to,
  icon,
  label,
  onSelect,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  onSelect: () => void;
}) {
  const Icon = icon;

  return (
    <Link
      to={to}
      role="menuitem"
      className="flex items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors hover:bg-surface-hover"
      onClick={onSelect}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </Link>
  );
}

function FloatingAddBookButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon-lg"
      className="fixed bottom-20 right-4 z-40 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[0_14px_30px_oklch(0.21_0_0_/_0.18)] hover:bg-primary/90 md:bottom-6 md:right-6"
      aria-label="Add book"
      onClick={onClick}
    >
      <Plus className="h-7 w-7" />
    </Button>
  );
}

function MobileBottomNav({ pathname, search }: { pathname: string; search: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border/80 bg-background/95 backdrop-blur md:hidden">
      {primaryNavLinks.map(({ to, label, icon: Icon }) => {
        const active = isActiveRoute(pathname, search, to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-[0.68rem] font-semibold uppercase tracking-[0.08em] transition-colors",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AppLayout() {
  return (
    <GenresProvider>
      <BooksProvider>
        <ProfileProvider>
          <AppLayoutContent />
        </ProfileProvider>
      </BooksProvider>
    </GenresProvider>
  );
}
