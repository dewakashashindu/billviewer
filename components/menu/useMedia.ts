"use client";

import { useEffect, useState } from "react";

/** SSR-safe media query hook (default false = mobile-first). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);

  return matches;
}

/** ≥1024px → desktop layout (sidebar + grid + sticky cart panel). */
export const useIsDesktop = () => useMediaQuery("(min-width: 1024px)");

/** ≥640px → wider grids / centred modals. */
export const useIsTabletUp = () => useMediaQuery("(min-width: 640px)");
