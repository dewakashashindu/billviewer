// ============================================================
// LOCATION: components/order/useOrderMenu.ts
// Loads the whole dining menu once and shapes it into
// category tabs → groups → items.
//
// Data comes from GET /api/menu/items (keyset pagination by
// MenuItemCode) so the same code works for a big POS menu.
// ============================================================
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  categoryLabel,
  categoryRank,
  type MenuGroup,
  type MenuItem,
  type MenuTab,
  type MenuTree,
} from "./types";

const PAGE_LIMIT = 100;
const MAX_PAGES = 20; // hard stop → 2,000 items

function buildTree(items: MenuItem[]): MenuTree {
  const seen = new Set<string>();
  const unique: MenuItem[] = [];
  for (const it of items) {
    if (!it?.id || seen.has(it.id)) continue;
    seen.add(it.id);
    unique.push(it);
  }

  const tabMap = new Map<string, MenuTab>();
  const groupMap = new Map<string, MenuGroup>();

  for (const item of unique) {
    const label = categoryLabel(item.categoryId);
    const tab = tabMap.get(label) ?? { key: label, label, count: 0 };
    tab.count += 1;
    tabMap.set(label, tab);

    const gName = (item.groupName || item.groupId || "Menu").trim();
    const gKey = `${label}::${item.groupId || gName}`;
    const group =
      groupMap.get(gKey) ??
      ({
        key: gKey,
        name: gName,
        tabKey: label,
        items: [],
        count: 0,
      } as MenuGroup);

    group.items.push(item);
    group.count += 1;
    groupMap.set(gKey, group);
  }

  const sortItems = (a: MenuItem, b: MenuItem) =>
    a.listOrder - b.listOrder || a.name.localeCompare(b.name);

  const groups: MenuGroup[] = [...groupMap.values()].map((g) => ({
    ...g,
    items: [...g.items].sort(sortItems),
  }));

  groups.sort((a, b) => {
    const r = categoryRank(a.tabKey) - categoryRank(b.tabKey);
    if (r !== 0) return r;
    const ao = Math.min(...a.items.map((i) => i.groupOrder || 999));
    const bo = Math.min(...b.items.map((i) => i.groupOrder || 999));
    return ao - bo || a.name.localeCompare(b.name);
  });

  const tabs: MenuTab[] = [...tabMap.values()].sort(
    (a, b) => categoryRank(a.label) - categoryRank(b.label) || a.label.localeCompare(b.label)
  );

  return { tabs, groups, items: unique };
}

export interface OrderMenuState extends MenuTree {
  loading: boolean;
  error: string | null;
  source: "database" | "mock" | "unknown";
  reload: () => void;
}

export function useOrderMenu(): OrderMenuState {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [source, setSource] = useState<"database" | "mock" | "unknown">("unknown");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const all: MenuItem[] = [];
        let after = "";
        for (let page = 0; page < MAX_PAGES; page++) {
          const res = await fetch(
            `/api/menu/items?limit=${PAGE_LIMIT}&after=${encodeURIComponent(after)}`,
            { cache: "no-store" }
          );
          const json = await res.json().catch(() => null);
          if (!res.ok || !json?.ok) {
            throw new Error(json?.error || "Unable to load the menu");
          }
          const batch: MenuItem[] = Array.isArray(json.items) ? json.items : [];
          all.push(...batch);
          if (json.source) setSource(json.source);
          if (!json.hasMore || batch.length === 0) break;
          after = String(json.nextCursor ?? "");
          if (!after) break;
        }
        if (alive) setItems(all);
      } catch (e) {
        if (alive) setError((e as Error)?.message ?? "Unable to load the menu");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [nonce]);

  const tree = useMemo(() => buildTree(items), [items]);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return { ...tree, loading, error, source, reload };
}
