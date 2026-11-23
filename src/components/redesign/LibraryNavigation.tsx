import { createContext, Suspense, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Tabs } from "radix-ui";
import { useLocation, useNavigate } from "react-router-dom";
import LoadingIndicator from "@/components/LoadingIndicator";
import { SlidingIndicator } from "@/components/ui/sliding-indicator";
import "./library-navigation.css";
import "./library-preview.css";

const tabs = [
  { label: "Books", to: "/library" },
  { label: "Collections", to: "/library/collections" },
  { label: "Series", to: "/library/series" },
] as const;

const SearchButtonSlot = createContext<HTMLElement | null>(null);

/** Keeps the heading and tab indicator mounted while the router swaps panels. */
export function LibraryTabs({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [searchSlot, setSearchSlot] = useState<HTMLDivElement | null>(null);
  const tab = tabs.find(item => item.to === pathname.replace(/\/$/, "")) ?? tabs[0];

  return (
    <Tabs.Root className="rj-library-tab-layout" value={tab.to} activationMode="manual" onValueChange={to => navigate(to)}>
      <div className="rj-redesign rj-library-preview">
        <header className="rj-library-heading">
          <div><p className="rj-library-eyebrow">Your reading collection</p><h1>Library</h1></div>
          <div ref={setSearchSlot} />
        </header>
        <Tabs.List className="rj-library-collections rj-tab-track" aria-label="Library collections">
          <SlidingIndicator />
          {tabs.map(({ label, to }) => (
            <Tabs.Trigger key={to} value={to} data-slot="tabs-trigger">{label}</Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>
      <Tabs.Content value={tab.to}>
        <Suspense fallback={<LoadingIndicator variant="page" />}>
          <div key={tab.to} className="rj-route-enter">
            <SearchButtonSlot.Provider value={searchSlot}>{children}</SearchButtonSlot.Provider>
          </div>
        </Suspense>
      </Tabs.Content>
    </Tabs.Root>
  );
}

export function LibrarySearchButton({ children }: { children: ReactNode }) {
  const slot = useContext(SearchButtonSlot);
  return slot ? createPortal(children, slot) : null;
}
