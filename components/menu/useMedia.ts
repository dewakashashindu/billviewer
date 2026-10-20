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

/** ≥1280px → the three-column desktop shell has room to breathe.
 *  Below this the sidebar + cart rails are narrowed and the dish
 *  grid drops to two columns, otherwise cards get ~100px wide. */
export const useIsWide = () => useMediaQuery("(min-width: 1280px)");
