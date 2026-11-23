import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Tabs } from "radix-ui";
import { useLocation, useNavigate } from "react-router-dom";
import { SlidingIndicator } from "@/components/ui/sliding-indicator";
import { getLibraryTab, libraryTabs } from "@/lib/libraryTabs";
import "./library-navigation.css";
import "./library-preview.css";

const SearchButtonSlot = createContext<HTMLElement | null>(null);

/** Keeps the heading and tab indicator mounted while the router swaps panels. */
export function LibraryTabs({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null);
  const tab = getLibraryTab(pathname) ?? libraryTabs[0];

  return (
    <Tabs.Root className="rj-library-tab-layout" value={tab.to} activationMode="manual" onValueChange={to => navigate(to)}>
      <div className="rj-redesign rj-library-preview">
        <header className="rj-library-heading">
          <div><p className="rj-library-eyebrow">Your reading collection</p><h1>Library</h1></div>
          <div ref={setSearchSlot} />
        </header>
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
          <SearchButtonSlot.Provider value={searchSlot}>{children}</SearchButtonSlot.Provider>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
}

export function LibrarySearchButton({ children }: { children: ReactNode }) {
  const slot = useContext(SearchButtonSlot);
  return slot ? createPortal(children, slot) : null;
}
