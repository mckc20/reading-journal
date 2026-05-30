import { lazy, Suspense, useState, type ComponentType } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookMarked,
  Bookmark,
  LayoutDashboard,
  Library,
  Menu,
  Plus,
  Search,
  Settings,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BooksProvider } from "@/context/BooksContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { useAuth, useProfile } from "@/context";
import { cn } from "@/lib/utils";
import readingJournalLogo from "@/assets/reading-journal-logo.png";

const AddBookDialog = lazy(() => import("./AddBookDialog"));

type NavLink = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const sidebarNavLinks: NavLink[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/library", label: "My Books", icon: Library },
  { to: "/series", label: "Series", icon: BookMarked },
  { to: "/authors", label: "Authors", icon: UserRound },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/shelves", label: "Shelves", icon: Bookmark },
];

const mobilePrimaryLinks: NavLink[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/library", label: "Books", icon: Library },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
];

const mobileMenuLinks: NavLink[] = [
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "My Books", icon: Library },
  { to: "/series", label: "Series", icon: BookMarked },
  { to: "/authors", label: "Authors", icon: UserRound },
  { to: "/shelves", label: "Shelves", icon: Bookmark },
  { to: "/groups", label: "Groups", icon: Users },
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

type SidebarProfileProps = {
  profile: ReturnType<typeof useProfile>["profile"];
  email?: string | null;
  displayName: string;
  settingsPath: string;
};

type AppHeaderProps = {
  pathname: string;
  search: string;
  onAddBookClick: () => void;
};

type AppShellProps = {
  pathname: string;
  search: string;
  addBookOpen: boolean;
  onAddBookOpenChange: (open: boolean) => void;
  appHeaderProps: AppHeaderProps;
  desktopProfileProps: SidebarProfileProps;
  mobileProfileProps: SidebarProfileProps;
};

function AppLayoutContent() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const location = useLocation();
  const [addBookOpen, setAddBookOpen] = useState(false);
  const displayName = getDisplayName(profile, user?.email);

  const desktopProfileProps: SidebarProfileProps = {
    profile,
    email: user?.email,
    displayName,
    settingsPath: "/settings/profile",
  };

  return (
    <AppShell
      pathname={location.pathname}
      search={location.search}
      addBookOpen={addBookOpen}
      onAddBookOpenChange={setAddBookOpen}
      appHeaderProps={{
        pathname: location.pathname,
        search: location.search,
        onAddBookClick: () => setAddBookOpen(true),
      }}
      desktopProfileProps={desktopProfileProps}
      mobileProfileProps={{ ...desktopProfileProps, settingsPath: "/settings" }}
    />
  );
}

function AppShell({
  pathname,
  search,
  addBookOpen,
  onAddBookOpenChange,
  appHeaderProps,
  desktopProfileProps,
  mobileProfileProps,
}: AppShellProps) {
  return (
    <>
      <div className="min-h-svh bg-background text-foreground md:flex">
        <DesktopSidebar
          pathname={pathname}
          search={search}
          profileProps={desktopProfileProps}
        />

        <div className="flex min-h-svh min-w-0 flex-1 flex-col">
          <MobileHeader {...appHeaderProps} profileProps={mobileProfileProps} />
          <DesktopUtilityBar onAddBookClick={appHeaderProps.onAddBookClick} />

          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-24 sm:px-6 md:px-8 md:py-8 md:pb-8 lg:px-10">
            <Outlet context={{ onAddBookClick: appHeaderProps.onAddBookClick }} />
          </main>

          <MobileBottomNav pathname={pathname} search={search} />
        </div>
      </div>

      <Suspense fallback={null}>
        {addBookOpen && (
          <AddBookDialog open={addBookOpen} onOpenChange={onAddBookOpenChange} />
        )}
      </Suspense>
    </>
  );
}

function DesktopSidebar({
  pathname,
  search,
  profileProps,
}: {
  pathname: string;
  search: string;
  profileProps: SidebarProfileProps;
}) {
  return (
    <aside className="sticky top-0 hidden h-svh w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 px-5">
        <img
          src={readingJournalLogo}
          alt="Reading Journal logo"
          className="h-7 w-7 rounded-sm object-cover dark:brightness-0 dark:invert"
        />
        <span className="font-heading text-sm font-medium">Reading Journal</span>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {sidebarNavLinks.map((link) => (
          <NavItem
            key={link.to}
            link={link}
            active={isActiveRoute(pathname, search, link.to)}
          />
        ))}
      </nav>

      <SidebarProfileFooter {...profileProps} />
    </aside>
  );
}

function DesktopUtilityBar({ onAddBookClick }: { onAddBookClick: () => void }) {
  return (
    <header className="sticky top-0 z-40 hidden h-14 items-center justify-end border-b bg-background/95 px-8 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:flex lg:px-10">
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" asChild>
          <Link to="/search" aria-label="Search">
            <Search className="h-5 w-5" />
          </Link>
        </Button>
        <Button
          size="default"
          variant="ghost"
          onClick={onAddBookClick}
          className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
        >
          <Plus className="h-4 w-4" />
          Add Book
        </Button>
      </div>
    </header>
  );
}

function MobileHeader({
  pathname,
  search,
  onAddBookClick,
  profileProps,
}: AppHeaderProps & { profileProps: SidebarProfileProps }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:hidden">
      <div className="flex h-14 items-center gap-2 px-4">
        <MobileMenu pathname={pathname} search={search} profileProps={profileProps} />

        <Link
          to="/"
          className="flex min-w-0 items-center gap-2 font-semibold text-foreground"
        >
          <img
            src={readingJournalLogo}
            alt="Reading Journal logo"
            className="h-6 w-6 rounded-sm object-cover dark:brightness-0 dark:invert"
          />
          <span className="truncate text-sm">Reading Journal</span>
        </Link>

        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" asChild>
            <Link to="/search" aria-label="Search">
              <Search className="h-5 w-5" />
            </Link>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onAddBookClick}
            aria-label="Add book"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function MobileMenu({
  pathname,
  search,
  profileProps,
}: {
  pathname: string;
  search: string;
  profileProps: SidebarProfileProps;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Open navigation menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>
      <DialogContent
        showCloseButton={false}
        className="left-0 top-0 h-svh max-w-80 translate-x-0 translate-y-0 content-start grid-rows-[auto_minmax(0,1fr)] gap-0 rounded-none border-r bg-background p-0"
      >
        <DialogHeader className="flex-row items-center justify-between border-b px-4 py-3">
          <DialogTitle>Menu</DialogTitle>
          <DialogClose asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Close navigation menu">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
            {mobileMenuLinks.map((link) => (
              <DialogClose asChild key={link.to}>
                <NavItem
                  link={link}
                  active={isActiveRoute(pathname, search, link.to)}
                  className="text-sm"
                />
              </DialogClose>
            ))}
          </nav>

          <DialogClose asChild>
            <SidebarProfileFooter {...profileProps} />
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MobileBottomNav({ pathname, search }: { pathname: string; search: string }) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t bg-background md:hidden">
      {mobilePrimaryLinks.map(({ to, label, icon: Icon }) => {
        const active = isActiveRoute(pathname, search, to);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
              active ? "font-medium text-foreground" : "text-muted-foreground"
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

function NavItem({
  link,
  active,
  className,
}: {
  link: NavLink;
  active: boolean;
  className?: string;
}) {
  const Icon = link.icon as ComponentType<{ className?: string }>;

  return (
    <Link
      to={link.to}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
        className
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="truncate">{link.label}</span>
    </Link>
  );
}

function SidebarProfileFooter({
  profile,
  email,
  displayName,
  settingsPath,
}: SidebarProfileProps) {
  return (
    <div className="border-t border-sidebar-border p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <ProfileAvatar profile={profile} email={email} className="h-10 w-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-sidebar-foreground">
            {displayName}
          </p>
          <Link
            to="/profile"
            className="text-xs text-sidebar-foreground/60 transition-colors hover:text-sidebar-foreground"
          >
            View profile
          </Link>
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          asChild
          className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <Link to={settingsPath} aria-label="Open settings">
            <Settings className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
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
