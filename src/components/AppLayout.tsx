import LoadingDialog from "@/components/LoadingDialog";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Link, Outlet, useLocation, useMatch, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  BookPlus,
  Clock3,
  Compass,
  Home,
  Library,
  Layers,
  Menu,
  MessageSquare,
  NotebookPen,
  Search,
  Settings,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import readingJournalLogo from "@/assets/rj-logo-transparent.png";
import { DropdownMenu } from "radix-ui";
import { CreateLauncher } from "@/components/redesign/HomeShell";
import "@/components/redesign/redesign.css";
import "@/components/redesign/app-theme.css";
import { SlidingIndicator } from "@/components/ui/sliding-indicator";
import { Button } from "@/components/ui/button";
import { AuthorsProvider } from "@/context/AuthorsContext";
import { BooksProvider } from "@/context/BooksContext";
import { GenresProvider } from "@/context/GenresContext";
import { ProfileProvider } from "@/context/ProfileContext";
import { useAuth, useUserSettings } from "@/context";
import { getChatNotifications, markChatNotificationRead } from "@/lib/chatNotifications";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/userSettings";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { BookTitleSearchResult } from "@/lib/bookLookup";
import ReleaseNotesDialog from "./ReleaseNotesDialog";
import BookFinishedCelebration from "./BookFinishedCelebration";
import type { Book, ChatMessageNotification } from "@/types";
import type { RecommendationItem } from "@/types/recommendations";

const AddBookDialog = lazy(() => import("./AddBookDialog"));
const AddSeriesDialog = lazy(() => import("./AddSeriesDialog"));
const AddJournalEntryDialog = lazy(() => import("./AddJournalEntryDialog"));

type AddAction = "book" | "series" | "entry";

const addActions = [
  { value: "book", label: "Add a book", icon: BookPlus },
  { value: "entry", label: "Add a journal entry", icon: NotebookPen },
  { value: "series", label: "Add a book series", icon: Layers },
] as const;

export interface AppLayoutOutletContext {
  onAddBookClick: () => void;
  openAddBook: (options?: AddBookDialogLaunchOptions) => void;
  openAddJournalEntry: (options?: AddJournalEntryLaunchOptions, trigger?: HTMLElement) => void;
  setDetailEditingOpen: (open: boolean) => void;
}

export interface AddBookDialogLaunchOptions {
  initialSeriesId?: string;
  initialVolumeNumber?: number;
  initialRecommendation?: RecommendationItem;
  initialCatalogBook?: BookTitleSearchResult;
  initiallyAddToWishlist?: boolean;
  initialBook?: Book;
  onSaved?: (book: Book) => void;
  onWishlistSaved?: () => void;
}

type AddJournalEntryLaunchOptions = Pick<ComponentProps<typeof AddJournalEntryDialog>, "initialBookId" | "initialTags" | "onSaved">;

type NavLink = {
  to: string;
  label: string;
  icon: LucideIcon;
};

const primaryNavLinks: NavLink[] = [
  { to: "/", label: "Home", icon: Home },
  { to: "/library", label: "Library", icon: Library },
  { to: "/library/journal", label: "Journal", icon: NotebookPen },
  { to: "/statistics", label: "Insights", icon: BarChart3 },
  { to: "/profile", label: "Profile", icon: UserRound },
];

const moreNavLinks: NavLink[] = [
  { to: "/search", label: "Search", icon: Search },
  { to: "/discover", label: "Discover", icon: Compass },
  { to: "/reading-history", label: "Reading History", icon: Clock3 },
  { to: "/wrap-ups", label: "Wrap-Ups", icon: Sparkles },
  { to: "/messages", label: "Messages", icon: MessageSquare },
  { to: "/settings", label: "Settings", icon: Settings },
];

function getPrimaryRoute(pathname: string) {
  if (pathname === "/" || pathname === "/statistics") return pathname;
  if (pathname === "/library/journal" || pathname.startsWith("/journal/")) return "/library/journal";
  if (pathname === "/profile" || pathname.startsWith("/profiles/")) return "/profile";
  if (/^\/(library|books|series|authors|genres)(?:\/|$)/.test(pathname)) return "/library";
}

function AppLayoutContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const isBookDetail = Boolean(useMatch("/books/:bookId"));
  const [addBookOpen, setAddBookOpen] = useState(false);
  const [addBookOptions, setAddBookOptions] = useState<AddBookDialogLaunchOptions | undefined>();
  const [journalEntryOptions, setJournalEntryOptions] = useState<AddJournalEntryLaunchOptions | undefined>();
  const [activeAddAction, setActiveAddAction] = useState<Exclude<AddAction, "book"> | null>(null);
  const [detailEditingOpen, setDetailEditingOpen] = useState(false);
  const addDialogStillOpen = useRef(false);
  const dialogReturnFocus = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    addDialogStillOpen.current = addBookOpen || activeAddAction !== null;
  }, [addBookOpen, activeAddAction]);

  const rememberDialogOpener = useCallback((trigger?: HTMLElement) => {
    if (trigger) {
      dialogReturnFocus.current = trigger;
      return;
    }
    const active = document.activeElement;
    // When one add form launches another, keep the opener outside the closing dialog.
    if (active instanceof HTMLElement && active.closest('[role="dialog"]') && dialogReturnFocus.current?.isConnected) return;
    dialogReturnFocus.current = active instanceof HTMLElement ? active : null;
  }, []);

  const openAddJournalEntry = useCallback((options?: AddJournalEntryLaunchOptions, trigger?: HTMLElement) => {
    rememberDialogOpener(trigger);
    setJournalEntryOptions(options);
    setActiveAddAction("entry");
  }, [rememberDialogOpener]);

  function restoreAddDialogFocus(event: Event) {
    // The loaded form must return to the original opener, not the removed loading shell.
    event.preventDefault();
    if (!addDialogStillOpen.current) dialogReturnFocus.current?.focus();
  }

  const isMessagesPage = location.pathname === "/messages";

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

  useLayoutEffect(() => {
    // Portalled dialogs and menus inherit the same colors as the signed-in UI.
    const root = document.documentElement;
    root.classList.add("rj-app-theme");
    return () => root.classList.remove("rj-app-theme");
  }, []);

  function openAddBook(options?: AddBookDialogLaunchOptions) {
    rememberDialogOpener();
    setAddBookOptions(options);
    setAddBookOpen(true);
  }

  function closeAddBook(open: boolean) {
    setAddBookOpen(open);
    if (!open) setAddBookOptions(undefined);
  }

  function handleAddedBook(book: Book) {
    const launchOptions = addBookOptions;
    launchOptions?.onSaved?.(book);
    if (!launchOptions?.onSaved) {
      navigate(`/books/${book.id}`);
    }
  }

  function openAddDialog(action: AddAction, trigger: HTMLButtonElement) {
    dialogReturnFocus.current = trigger;
    if (action === "book") {
      setAddBookOptions(undefined);
      setAddBookOpen(true);
    } else if (action === "entry") {
      openAddJournalEntry(undefined, trigger);
    } else {
      setActiveAddAction(action);
    }
  }

  const addLauncher = <CreateLauncher options={addActions} onCreate={openAddDialog} opensDialog />;

  return (
    <>
      <div className={cn("rj-app min-h-svh bg-background text-foreground", isBookDetail && "rj-app--book-detail")}>
        <a className="rj-skip-link" href="#app-content">Skip to content</a>
        <AppHeader pathname={location.pathname} addLauncher={isMessagesPage ? addLauncher : undefined} />
        <main
          id="app-content"
          tabIndex={-1}
          className={isMessagesPage ? "rj-app-messages" : "rj-app-content"}
        >
          <Outlet context={{
            onAddBookClick: () => openAddBook(),
            openAddBook,
            openAddJournalEntry,
            setDetailEditingOpen,
          } satisfies AppLayoutOutletContext} />
        </main>
        {!detailEditingOpen && !isMessagesPage && (
          <div className="rj-floating-add">{addLauncher}</div>
        )}
      </div>

      <Suspense fallback={
        <LoadingDialog
          title={addBookOpen ? (addBookOptions?.initialBook ? "Edit Wishlist Item" : "Add Book") : activeAddAction === "entry" ? "Add Journal Entry" : "Add Series"}
          onOpenChange={(open) => {
            if (!open) {
              addDialogStillOpen.current = false;
              closeAddBook(false);
              setActiveAddAction(null);
            }
          }}
          stillOpen={addDialogStillOpen}
          returnFocus={dialogReturnFocus}
        />
      }>
        {addBookOpen && (
          <AddBookDialog
            onCloseAutoFocus={restoreAddDialogFocus}
            open={addBookOpen}
            onOpenChange={closeAddBook}
            initialRecommendation={addBookOptions?.initialRecommendation}
            initialCatalogBook={addBookOptions?.initialCatalogBook}
            initiallyAddToWishlist={addBookOptions?.initiallyAddToWishlist}
            initialBook={addBookOptions?.initialBook}
            initialSeriesId={addBookOptions?.initialSeriesId}
            initialVolumeNumber={addBookOptions?.initialVolumeNumber}
            onSaved={handleAddedBook}
            onWishlistSaved={addBookOptions?.onWishlistSaved}
          />
        )}
        {activeAddAction === "series" && (
          <AddSeriesDialog
            onCloseAutoFocus={restoreAddDialogFocus}
            open
            onOpenChange={(open) => !open && setActiveAddAction(null)}
            openAddBook={openAddBook}
            onSaved={(series) => navigate(`/series/${series.id}`)}
          />
        )}
        {activeAddAction === "entry" && (
          <AddJournalEntryDialog
            {...journalEntryOptions}
            onCloseAutoFocus={restoreAddDialogFocus}
            open
            onOpenChange={(open) => {
              if (!open) {
                setActiveAddAction(null);
                setJournalEntryOptions(undefined);
              }
            }}
            onSubmitSaved={(entry) => {
              if (!journalEntryOptions?.onSaved) {
                navigate(entry.public_id ? `/journal/${entry.public_id}` : "/library/journal");
              }
            }}
          />
        )}
      </Suspense>

      <ReleaseNotesDialog />
      <BookFinishedCelebration />
    </>
  );
}

function AppHeader({ pathname, addLauncher }: { pathname: string; addLauncher?: ReactNode }) {
  const activeRoute = getPrimaryRoute(pathname);

  return (
    <div className="rj-app-header-wrap">
      <header className="rj-app-header">
        <Link to="/" className="rj-brand" aria-label="Reading Journal home">
          <img src={readingJournalLogo} alt="" />
          <span>Reading Journal</span>
        </Link>
        <nav className="rj-navigation rj-tab-track" aria-label="Primary navigation">
          <SlidingIndicator />
          {primaryNavLinks.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} aria-current={activeRoute === to ? "page" : undefined}>
              <Icon size={22} aria-hidden="true" />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="rj-header-actions">
          {addLauncher}
          <NotificationsMenu />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="icon-lg" variant="ghost" aria-label="More navigation">
                <Menu aria-hidden="true" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="rj-add-menu" align="end" sideOffset={8} collisionPadding={12}>
                {moreNavLinks.map(({ to, label, icon: Icon }) => (
                  <DropdownMenu.Item key={to} asChild>
                    <Link to={to} aria-current={pathname === to || pathname.startsWith(`${to}/`) ? "page" : undefined}>
                      <Icon size={18} aria-hidden="true" />
                      {label}
                    </Link>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </header>
    </div>
  );
}

function NotificationsMenu() {
  const { user } = useAuth();
  const { settings } = useUserSettings();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<ChatMessageNotification[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const chatNotificationsEnabled = (settings?.notifications ?? DEFAULT_NOTIFICATION_SETTINGS).chat_notifications;

  useEffect(() => {
    if (!user || !chatNotificationsEnabled) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    function loadNotifications() {
      void getChatNotifications()
        .then((nextNotifications) => {
          if (!cancelled) setNotifications(nextNotifications);
        })
        .catch(() => {
          if (!cancelled) setNotifications([]);
        });
    }

    loadNotifications();

    const channel = supabase
      .channel(`chat-notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_message_notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        loadNotifications,
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [chatNotificationsEnabled, user?.id]);

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

  function openNotification(notification: ChatMessageNotification) {
    setNotifications((current) => current.map((item) => (
      item.id === notification.id && !item.read_at
        ? { ...item, read_at: new Date().toISOString() }
        : item
    )));
    setOpen(false);
    void markChatNotificationRead(notification.id).catch(() => undefined);
    navigate("/messages", { state: { preferredGroupId: notification.group_id } });
  }

  const unreadCount = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div ref={menuRef} className="relative">
      <Button
        type="button"
        size="icon-lg"
        variant="ghost"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell className="h-5 w-5" />
      </Button>
      {unreadCount > 0 && (
        <span
          className="pointer-events-none absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background"
          aria-label={`${unreadCount} unread message notification${unreadCount === 1 ? "" : "s"}`}
        />
      )}

      {open && (
        <div
          role="menu"
          className="rj-menu-motion absolute right-0 top-11 z-50 w-[min(20rem,calc(100vw-5rem))] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-[var(--shadow-popover)]"
        >
          <div className="border-b px-3 py-2.5">
            <p className="text-sm font-medium">Notifications</p>
          </div>
          {!chatNotificationsEnabled ? (
            <p className="px-3 py-4 text-xs leading-5 text-muted-foreground">Chat notifications are off.</p>
          ) : notifications.length === 0 ? (
            <p className="px-3 py-4 text-xs leading-5 text-muted-foreground">No new messages.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto p-1.5">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  role="menuitem"
                  className={cn(
                    "w-full rounded-md px-2.5 py-2.5 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    !notification.read_at && "bg-primary/10 hover:bg-primary/15",
                  )}
                  onClick={() => openNotification(notification)}
                >
                  <p className="truncate text-sm font-medium">{notification.sender_name}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {notification.message_preview}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
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
