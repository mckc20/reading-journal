import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Plus, LogOut, BookMarked, LayoutDashboard, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BooksProvider } from "@/context/BooksContext";
import { useAuth } from "@/context";
import AddBookDialog from "./AddBookDialog";
import { cn } from "@/lib/utils";

const navLinks = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/library", label: "Library", icon: Library },
];

export default function AppLayout() {
  const { signOut } = useAuth();
  const location = useLocation();
  const [addBookOpen, setAddBookOpen] = useState(false);

  return (
    <BooksProvider>
      <div className="min-h-svh flex flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4">
            {/* Logo / app name */}
            <Link
              to="/"
              className="flex items-center gap-2 font-semibold text-foreground"
            >
              <BookMarked className="h-5 w-5" />
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
              <Button
                size="icon"
                variant="ghost"
                onClick={() => signOut()}
                aria-label="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </Button>
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

      <AddBookDialog open={addBookOpen} onOpenChange={setAddBookOpen} />
    </BooksProvider>
  );
}
