import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BookOpen,
  Compass,
  Home,
  Library,
  LibraryBig,
  Menu,
  MessageCircle,
  MessageSquare,
  NotebookPen,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
  createLucideIcon,
  type LucideIcon,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Button } from "@/components/ui/button";
import { AuthorsProvider } from "@/context/AuthorsContext";
import { BooksProvider } from "@/context/BooksContext";
import { GenresProvider } from "@/context/GenresContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { useAuth, useProfile } from "@/context";
import { cn } from "@/lib/utils";
import ReleaseNotesDialog from "./ReleaseNotesDialog";
import type { Book } from "@/types";

const AddBookDialog = lazy(() => import("./AddBookDialog"));
const AddAuthorDialog = lazy(() => import("./AddAuthorDialog"));
const AddSeriesDialog = lazy(() => import("./AddSeriesDialog"));
const AddChatDialog = lazy(() => import("./AddChatDialog"));

type AddAction = "book" | "author" | "series" | "note" | "chat";

const addActions: Array<{
  key: AddAction;
  label: string;
  icon: LucideIcon;
}> = [
  { key: "book", label: "Book", icon: BookOpen },
  { key: "author", label: "Author", icon: UserRound },
  { key: "series", label: "Series", icon: LibraryBig },
  { key: "note", label: "Entry", icon: NotebookPen },
  { key: "chat", label: "Chat", icon: MessageCircle },
];

export interface AppLayoutOutletContext {
  onAddBookClick: () => void;
  openAddBook: (options?: AddBookDialogLaunchOptions) => void;
  setDetailEditingOpen: (open: boolean) => void;
}

export interface AddBookDialogLaunchOptions {
  initialSeriesId?: string;
  initialVolumeNumber?: number;
  onSaved?: (book: Book) => void;
}

type NavLink = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const primaryNavLinks: NavLink[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/library", label: "Library", icon: Library },
  { to: "/discover", label: "Discover", icon: Compass },
];

const RotateCcwClock = createLucideIcon("rotate-ccw-clock", [
  ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8", key: "1357e3" }],
  ["path", { d: "M3 3v5h5", key: "1xhq8a" }],
  ["path", { d: "M12 7v5l4 2", key: "1fdv2h" }],
]);

const drawerNavLinks: NavLink[] = [
  { to: "/statistics", label: "Reading Statistics", icon: BarChart3 },
  { to: "/reading-history", label: "Reading History", icon: RotateCcwClock },
  { to: "/wrap-ups", label: "Wrap-Ups", icon: Sparkles },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
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
  const { user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const navigate = useNavigate();
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [addBookOptions, setAddBookOptions] = useState<AddBookDialogLaunchOptions | undefined>();
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [activeAddAction, setActiveAddAction] = useState<AddAction | null>(null);
  const [detailEditingOpen, setDetailEditingOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const desktopAddButtonRef = useRef<HTMLButtonElement>(null);
  const desktopAddMenuRef = useRef<HTMLDivElement>(null);
  const floatingAddButtonRef = useRef<HTMLButtonElement>(null);
  const floatingAddMenuRef = useRef<HTMLDivElement>(null);
  const displayName = getDisplayName(profile, user?.email);
  const hideFloatingAddButton = detailEditingOpen;

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  useEffect(() => {
    if (!addMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const clickedInsideAddMenu = [
        desktopAddButtonRef,
        desktopAddMenuRef,
        floatingAddButtonRef,
        floatingAddMenuRef,
      ].some((ref) => ref.current?.contains(target));

      if (clickedInsideAddMenu) {
        return;
      }
      setAddMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setAddMenuOpen(false);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [addMenuOpen]);

  function openAddBook(options?: AddBookDialogLaunchOptions) {
    setAddBookOptions(options);
    setAddBookOpen(true);
  }

  function closeAddBook(open: boolean) {
    setAddBookOpen(open);
    if (!open) setAddBookOptions(undefined);
  }

  function openAddDialog(action: AddAction) {
    setAddMenuOpen(false);
    if (action === "book") {
      openAddBook();
      return;
    }
    if (action === "note") {
      const bookMatch = location.pathname.match(/^\/books\/([^/]+)/);
      const seriesMatch = location.pathname.match(/^\/series\/([^/]+)/);
      const authorMatch = location.pathname.match(/^\/authors\/([^/]+)/);

      if (bookMatch) {
        navigate(`/books/${bookMatch[1]}/journal?new=1`);
        return;
      }
      if (seriesMatch) {
        navigate(`/series/${seriesMatch[1]}/journal?new=1`);
        return;
      }
      if (authorMatch) {
        navigate(`/authors/${authorMatch[1]}/journal?new=1`);
        return;
      }

      navigate("/library/journal");
      return;
    }
    setActiveAddAction(action);
  }

  return (
    <>
      <div className="min-h-svh bg-background text-foreground">
        <AppHeader
          pathname={location.pathname}
          search={location.search}
          profile={profile}
          email={user?.email}
          displayName={displayName}
          drawerOpen={drawerOpen}
          addMenuOpen={addMenuOpen}
          addButtonRef={desktopAddButtonRef}
          addMenuRef={desktopAddMenuRef}
          onToggleDrawer={() => setDrawerOpen((current) => !current)}
          onCloseDrawer={() => setDrawerOpen(false)}
          onToggleAddMenu={() => setAddMenuOpen((current) => !current)}
          onSelectAddAction={openAddDialog}
        />

        <SideDrawer
          open={drawerOpen}
          pathname={location.pathname}
          search={location.search}
          onToggleOpen={() => setDrawerOpen((current) => !current)}
          onClose={() => setDrawerOpen(false)}
        />

        <main
          className={cn(
            "mx-auto w-full max-w-7xl flex-1 px-5 py-5 pb-28 transition-[padding] duration-200 sm:px-8 md:py-8 md:pt-24 md:pr-10 lg:pr-12",
            drawerOpen
              ? "md:pl-72 md:[--detail-bg-left-offset:7.75rem] lg:[--detail-bg-left-offset:7.5rem]"
              : "md:pl-24 md:[--detail-bg-left-offset:1.75rem] lg:[--detail-bg-left-offset:1.5rem]",
          )}
        >
          <Outlet
            context={
              {
                onAddBookClick: () => openAddBook(),
                openAddBook,
                setDetailEditingOpen,
              } satisfies AppLayoutOutletContext
            }
          />
        </main>

        {!hideFloatingAddButton && (
          <FloatingAddButtonMenu
            buttonRef={floatingAddButtonRef}
            menuRef={floatingAddMenuRef}
            open={addMenuOpen}
            onToggleOpen={() => setAddMenuOpen((current) => !current)}
            onSelect={openAddDialog}
          />
        )}
        <MobileBottomNav pathname={location.pathname} search={location.search} />
      </div>

      <Suspense fallback={null}>
        {addBookOpen && (
          <AddBookDialog
            open={addBookOpen}
            onOpenChange={closeAddBook}
            initialSeriesId={addBookOptions?.initialSeriesId}
            initialVolumeNumber={addBookOptions?.initialVolumeNumber}
            onSaved={addBookOptions?.onSaved}
          />
        )}
        {activeAddAction === "author" && (
          <AddAuthorDialog
            open
            onOpenChange={(open) => !open && setActiveAddAction(null)}
          />
        )}
        {activeAddAction === "series" && (
          <AddSeriesDialog
            open
            onOpenChange={(open) => !open && setActiveAddAction(null)}
            openAddBook={openAddBook}
            onSaved={(series) => navigate(`/series/${series.id}`)}
          />
        )}
        {activeAddAction === "chat" && (
          <AddChatDialog
            open
            onOpenChange={(open) => !open && setActiveAddAction(null)}
          />
        )}
      </Suspense>

      <ReleaseNotesDialog />
    </>
  );
}

function AppHeader({
  pathname,
  search,
  profile,
  email,
  displayName,
  drawerOpen,
  addMenuOpen,
  addButtonRef,
  addMenuRef,
  onToggleDrawer,
  onCloseDrawer,
  onToggleAddMenu,
  onSelectAddAction,
}: {
  pathname: string;
  search: string;
  profile: ReturnType<typeof useProfile>["profile"];
  email?: string | null;
  displayName: string;
  drawerOpen: boolean;
  addMenuOpen: boolean;
  addButtonRef: RefObject<HTMLButtonElement>;
  addMenuRef: RefObject<HTMLDivElement>;
  onToggleDrawer: () => void;
  onCloseDrawer: () => void;
  onToggleAddMenu: () => void;
  onSelectAddAction: (action: AddAction) => void;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:fixed md:left-16 md:right-0",
      )}
    >
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-8 lg:px-10">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="md:hidden"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            onClick={onToggleDrawer}
          >
            {drawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <Link
            to="/"
            className={cn(
              "flex min-w-0 items-center gap-3 font-heading font-medium text-foreground",
              drawerOpen ? "md:hidden" : "md:flex",
            )}
            aria-label="Reading Journal home"
            onClick={onCloseDrawer}
          >
            <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="sr-only truncate text-sm md:not-sr-only">Reading Journal</span>
          </Link>
        </div>

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
          <DesktopAddButtonMenu
            buttonRef={addButtonRef}
            menuRef={addMenuRef}
            open={addMenuOpen}
            onToggleOpen={onToggleAddMenu}
            onSelect={onSelectAddAction}
          />
          <Button size="icon" variant="ghost" asChild>
            <Link to="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          <NotificationsMenu />
          <Link
            to="/profile"
            className="flex rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
            aria-label={`Open profile for ${displayName}`}
          >
            <ProfileAvatar profile={profile} email={email} className="h-9 w-9 text-sm" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function SideDrawer({
  open,
  pathname,
  search,
  onToggleOpen,
  onClose,
}: {
  open: boolean;
  pathname: string;
  search: string;
  onToggleOpen: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm md:hidden"
          aria-label="Close menu"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          "fixed bottom-0 left-0 top-0 z-[60] flex flex-col border-r border-border bg-background transition-all duration-200",
          "md:block",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          open ? "w-72 md:w-64" : "w-16",
          open ? "md:z-[60]" : "md:z-40",
        )}
        aria-label="Side navigation"
      >
        <div
          className={cn(
            "flex shrink-0 px-2",
            open ? "h-16 items-center gap-2" : "h-16 items-center justify-center",
          )}
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0"
            aria-label={open ? "Collapse menu" : "Expand menu"}
            aria-expanded={open}
            onClick={onToggleOpen}
          >
            {open ? <X className="h-5 w-5 md:hidden" /> : null}
            <Menu className={cn("h-5 w-5", open && "hidden md:block")} />
          </Button>
          {open && (
            <Link
              to="/"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-2 font-heading font-medium text-foreground transition-colors hover:text-primary"
              aria-label="Reading Journal home"
              onClick={onClose}
            >
              <BookOpen className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <span className="truncate text-sm">Reading Journal</span>
            </Link>
          )}
        </div>
        <nav className="flex min-h-0 flex-1 flex-col gap-1 px-2 py-4">
          {drawerNavLinks.map((link) => {
            const active = isActiveRoute(pathname, search, link.to);
            const Icon = link.icon;

            return (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors hover:bg-surface-hover",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                  !open && "md:justify-center md:px-0",
                )}
                aria-label={link.label}
                title={!open ? link.label : undefined}
                onClick={onClose}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className={cn("truncate", !open && "md:sr-only")}>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
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

function NotificationsMenu() {
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

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-5 w-5" />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-64 rounded-md border border-border bg-popover p-3 text-popover-foreground shadow-[var(--shadow-popover)]"
        >
          <p className="text-sm font-medium">Notifications</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            New message notifications will appear here.
          </p>
        </div>
      )}
    </div>
  );
}

function AddMenuPanel({ onSelect }: { onSelect: (action: AddAction) => void }) {
  return (
    <>
      <div className="mb-1 px-2 pt-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        Add
      </div>
      <div className="space-y-1">
        {addActions.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-surface-hover"
            onClick={() => onSelect(key)}
          >
            <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

function DesktopAddButtonMenu({
  open,
  onToggleOpen,
  onSelect,
  buttonRef,
  menuRef,
}: {
  open: boolean;
  onToggleOpen: () => void;
  onSelect: (action: AddAction) => void;
  buttonRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div className="relative hidden md:block">
      <Button
        ref={buttonRef}
        type="button"
        size="sm"
        className="gap-1.5"
        aria-label="Add"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        <Plus className="h-4 w-4" />
        Add
      </Button>
      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-11 z-50 w-52 overflow-hidden rounded-xl border border-border bg-popover p-2 shadow-[var(--shadow-popover)]"
        >
          <AddMenuPanel onSelect={onSelect} />
        </div>
      )}
    </div>
  );
}

function FloatingAddButtonMenu({
  open,
  onToggleOpen,
  onSelect,
  buttonRef,
  menuRef,
}: {
  open: boolean;
  onToggleOpen: () => void;
  onSelect: (action: AddAction) => void;
  buttonRef: RefObject<HTMLButtonElement>;
  menuRef: RefObject<HTMLDivElement>;
}) {
  return (
    <div className="fixed bottom-20 right-4 z-40 md:hidden">
      {open && (
        <div
          ref={menuRef}
          className="absolute bottom-full right-0 mb-3 w-52 overflow-hidden rounded-xl border border-border bg-popover p-2 shadow-[var(--shadow-popover)]"
        >
          <AddMenuPanel onSelect={onSelect} />
        </div>
      )}
      <Button
        ref={buttonRef}
        type="button"
        size="icon-lg"
        className="h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[0_14px_30px_oklch(0.21_0_0_/_0.18)] hover:bg-primary/90"
        aria-label="Add"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        <Plus className="h-7 w-7" />
      </Button>
    </div>
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
    <AuthorsProvider>
      <GenresProvider>
        <BooksProvider>
          <ProfileProvider>
            <AppLayoutContent />
          </ProfileProvider>
        </BooksProvider>
      </GenresProvider>
    </AuthorsProvider>
  );
}
