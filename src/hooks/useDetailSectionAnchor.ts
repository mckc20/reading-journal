import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function useDetailSectionAnchor(sectionId: string, enabled = true) {
  const ref = useRef<HTMLElement>(null);
  const { hash, key } = useLocation();
  useEffect(() => {
    const section = ref.current;
    if (enabled && hash === `#${sectionId}` && section && !section.closest("[inert]")) {
      section.scrollIntoView({ block: "start" });
    }
  }, [enabled, hash, key, sectionId]);
  return ref;
}
