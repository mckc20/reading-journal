import type { AppLayoutOutletContext } from "@/components/AppLayout";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Tabs } from "radix-ui";
import { Outlet, useLocation, useNavigate, useNavigation, useOutletContext } from "react-router-dom";
import { SlidingIndicator } from "@/components/ui/sliding-indicator";
import { getLibraryTab, librarySorts, libraryTabs, type LibrarySort } from "@/lib/libraryTabs";
import "./library-navigation.css";
import "./library-preview.css";

const LibraryPresentation = createContext<{
  sort: LibrarySort;
  setSort: (sort: LibrarySort) => void;
  sortChanged: boolean;
}>({ sort: "recent", setSort: () => {}, sortChanged: false });

export function useLibraryPresentation() {
  return useContext(LibraryPresentation);
}

/** Keeps the shared controls mounted while the router swaps panels. */
export function LibraryTabs({ children, pendingPath }: { children: ReactNode; pendingPath?: string }) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const tab = getLibraryTab(pathname) ?? libraryTabs[0];
  const params = new URLSearchParams(search);
  const collectionPage = tab.label === "Collections" && params.has("collection");
  const highlighted = (pendingPath && getLibraryTab(pendingPath)) || tab;
  const [selectedSort, setSort] = useState<LibrarySort>();
  const sortParam = params.get("sort");
  const linkedSort = librarySorts.find(option => option.value === sortParam)?.value;
  const isSeries = tab.label === "Series";
  const activeSort = isSeries ? undefined : selectedSort;
  const sort = activeSort ?? linkedSort ?? (isSeries ? "title" : "recent");

  return (
    <LibraryPresentation.Provider value={{ sort, setSort, sortChanged: activeSort !== undefined }}>
      <Tabs.Root className="rj-library-tab-layout" value={tab.to} activationMode="manual" onValueChange={to => navigate(to)}>
        {!collectionPage && <>
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
        </>}
        <Tabs.Content value={tab.to} {...(collectionPage ? { role: "presentation", "aria-labelledby": undefined, tabIndex: undefined } : {})}>{children}</Tabs.Content>
      </Tabs.Root>
    </LibraryPresentation.Provider>
  );
}

export function LibraryLayoutRoute() {
  const appContext = useOutletContext<AppLayoutOutletContext>();
  const navigation = useNavigation();
  return <LibraryTabs pendingPath={navigation.location?.pathname}><Outlet context={appContext} /></LibraryTabs>;
}
