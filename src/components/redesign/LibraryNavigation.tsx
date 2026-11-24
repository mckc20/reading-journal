import { createContext, useContext, useState, type ReactNode } from "react";
import { Grid2X2, List } from "lucide-react";
import { Tabs } from "radix-ui";
import { useLocation, useNavigate } from "react-router-dom";
import { SlidingIndicator } from "@/components/ui/sliding-indicator";
import { Button } from "@/components/ui/button";
import { getLibraryTab, libraryTabs, type LibraryLayout, type LibrarySort } from "@/lib/libraryTabs";
import "./library-navigation.css";
import "./library-preview.css";

const LibraryPresentation = createContext<{
  sort: LibrarySort;
  setSort: (sort: LibrarySort) => void;
  view: LibraryLayout;
  setView: (view: LibraryLayout) => void;
  sortChanged: boolean;
  animateLayout: boolean;
}>({ sort: "recent", setSort: () => {}, view: "grid", setView: () => {}, sortChanged: false, animateLayout: false });

export function useLibraryPresentation() {
  return useContext(LibraryPresentation);
}

export function LibraryViewSwitch() {
  const { view, setView } = useLibraryPresentation();
  return (
    <div className="rj-library-view rj-tab-track" role="group" aria-label="Library view">
      <SlidingIndicator />
      <Button type="button" variant="ghost" size="icon" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 size={18} /></Button>
      <Button type="button" variant="ghost" size="icon" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={18} /></Button>
    </div>
  );
}

/** Keeps the shared controls mounted while the router swaps panels. */
export function LibraryTabs({ children, pendingPath }: { children: ReactNode; pendingPath?: string }) {
  const { key, pathname, search } = useLocation();
  const navigate = useNavigate();
  const tab = getLibraryTab(pathname) ?? libraryTabs[0];
  const highlighted = (pendingPath && getLibraryTab(pendingPath)) || tab;
  const [selectedSort, setSort] = useState<LibrarySort>();
  const [view, setView] = useState<LibraryLayout>("grid");
  const [layoutAnimationKey, setLayoutAnimationKey] = useState<string>();
  const legacySeries = tab.label === "Series" ? new URLSearchParams(search) : null;
  const sort = selectedSort ?? (legacySeries?.get("sort") === "name" ? "title" : "recent");

  function changeView(next: LibraryLayout) {
    if (next === view) return;
    setView(next);
    setLayoutAnimationKey(key);
  }

  return (
    <LibraryPresentation.Provider value={{ sort, setSort, view, setView: changeView, sortChanged: selectedSort !== undefined, animateLayout: layoutAnimationKey === key && !pendingPath }}>
      <Tabs.Root className="rj-library-tab-layout" value={tab.to} activationMode="manual" onValueChange={to => { setLayoutAnimationKey(undefined); navigate(to); }}>
        <header className="rj-redesign rj-library-heading" data-library-header>
          <h1>Library</h1>
        </header>
        <div className="rj-redesign">
          <Tabs.List className="rj-library-collections rj-tab-track" aria-label="Library collections">
            <SlidingIndicator activeSelector="[data-highlighted]" />
            {libraryTabs.map(({ label, to }) => (
              <Tabs.Trigger key={to} value={to} data-highlighted={highlighted.to === to || undefined}>
                <span>{label}</span>
                <span className="rj-library-tab-label-width" aria-hidden="true">{label}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>
        <Tabs.Content value={tab.to}>{children}</Tabs.Content>
      </Tabs.Root>
    </LibraryPresentation.Provider>
  );
}
