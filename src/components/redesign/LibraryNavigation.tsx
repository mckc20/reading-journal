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
  sortChanged: boolean;
  animateLayout: boolean;
}>({ sort: "recent", setSort: () => {}, view: "grid", sortChanged: false, animateLayout: false });

export function useLibraryPresentation() {
  return useContext(LibraryPresentation);
}

/** Keeps the shared controls and tab indicator mounted while the router swaps panels. */
export function LibraryTabs({ children }: { children: ReactNode }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const tab = getLibraryTab(pathname) ?? libraryTabs[0];
  const [selectedSort, setSort] = useState<LibrarySort>();
  const [selectedView, setView] = useState<LibraryLayout>();
  const legacySeries = tab.label === "Series" ? new URLSearchParams(search) : null;
  const sort = selectedSort ?? (legacySeries?.get("sort") === "name" ? "title" : "recent");
  const view = selectedView ?? (legacySeries?.get("display") === "table" ? "list" : "grid");

  return (
    <LibraryPresentation.Provider value={{ sort, setSort, view, sortChanged: selectedSort !== undefined, animateLayout: selectedView !== undefined }}>
      <Tabs.Root className="rj-library-tab-layout" value={tab.to} activationMode="manual" onValueChange={to => navigate(to)}>
        <header className="rj-redesign rj-library-heading" data-library-header>
          <h1>Library</h1>
          <div className="rj-library-view rj-tab-track" role="group" aria-label="Library view">
            <SlidingIndicator />
            <Button variant="ghost" size="icon" aria-label="Grid view" aria-pressed={view === "grid"} onClick={() => setView("grid")}><Grid2X2 size={18} /></Button>
            <Button variant="ghost" size="icon" aria-label="List view" aria-pressed={view === "list"} onClick={() => setView("list")}><List size={18} /></Button>
          </div>
        </header>
        <div className="rj-redesign">
          <Tabs.List className="rj-library-collections rj-tab-track" aria-label="Library collections">
            <SlidingIndicator />
            {libraryTabs.map(({ label, to }) => (
              <Tabs.Trigger key={to} value={to} data-slot="tabs-trigger">
                <span>{label}</span>
                <span className="rj-library-tab-label-width" aria-hidden="true">{label}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </div>
        <Tabs.Content value={tab.to}>
          <div key={tab.to} className="rj-library-panel">
            {children}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </LibraryPresentation.Provider>
  );
}
