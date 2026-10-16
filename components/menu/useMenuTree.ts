"use client";

// ============================================================
// LOCATION: components/menu/useMenuTree.ts
// Loads the whole Dining menu once through the existing
// /api/menu/items endpoint (keyset pagination) and shapes it into
// tabs → groups (Level 1) → sub-groups (Level 2) → items.
// Same idea as itemStore.hydrateItems() in the Expo app, without
// the MMKV cache (the browser + HTTP cache handle it instead).
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { categoryLabel, categoryRank } from "./theme";
import type { GroupCard, MenuItem, MenuTab, MenuTree, SearchableItem, SubGroup } from "./types";

const PAGE_LIMIT = 100;
const MAX_PAGES = 20; // hard stop: 2,000 items

function buildTree(items: MenuItem[]): MenuTree {
  const seen = new Set<string>();
  const unique: MenuItem[] = [];
  for (const it of items) {
    if (!it?.id || seen.has(it.id)) continue;
    seen.add(it.id);
    unique.push(it);
  }

  const tabMap = new Map<string, MenuTab>();
  const groupMap = new Map<string, GroupCard>();

  for (const item of unique) {
    const label = categoryLabel(item.categoryId);
    const tabKey = label;
    const tab = tabMap.get(tabKey) ?? { key: tabKey, label, count: 0 };
    tab.count += 1;
    tabMap.set(tabKey, tab);

    const gName = (item.groupName || item.groupId || "Menu").trim();
    const gKey = `${tabKey}::${item.groupId || gName}`;
    const group =
      groupMap.get(gKey) ??
      ({
        key: gKey,
        name: gName,
        categoryId: item.categoryId,
        items: [],
        subGroups: [],
        count: 0,
        imageUrl: null,
      } as GroupCard);

    const subName = (item.subGroupName || item.subGroupId || "").trim();
    if (subName) {
      let sub: SubGroup | undefined = group.subGroups.find((s) => s.name === subName);
      if (!sub) {
        sub = { key: `${gKey}::${item.subGroupId || subName}`, name: subName, items: [] };
        group.subGroups.push(sub);
      }
      sub.items.push(item);
    } else {
      group.items.push(item);
    }

    group.count += 1;
    groupMap.set(gKey, group);
  }

  const sortItems = (a: MenuItem, b: MenuItem) =>
    a.listOrder - b.listOrder || a.name.localeCompare(b.name);

  const groups: GroupCard[] = [...groupMap.values()].map((g) => {
    const items = [...g.items].sort(sortItems);
    const subGroups = g.subGroups
      .map((s) => ({ ...s, items: [...s.items].sort(sortItems) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    const representative =
      items.find((i) => i.imageUrl) ?? subGroups.flatMap((s) => s.items).find((i) => i.imageUrl);
    return { ...g, items, subGroups, imageUrl: representative?.imageUrl ?? null };
  });

  groups.sort((a, b) => {
    const r = categoryRank(categoryLabel(a.categoryId)) - categoryRank(categoryLabel(b.categoryId));
    if (r !== 0) return r;
    const ao = Math.min(...[...a.items, ...a.subGroups.flatMap((s) => s.items)].map((i) => i.groupOrder || 999));
    const bo = Math.min(...[...b.items, ...b.subGroups.flatMap((s) => s.items)].map((i) => i.groupOrder || 999));
    return ao - bo || a.name.localeCompare(b.name);
  });

  const tabs: MenuTab[] = [...tabMap.values()].sort(
    (a, b) => categoryRank(a.label) - categoryRank(b.label) || a.label.localeCompare(b.label)
  );

  const searchable: SearchableItem[] = groups.flatMap((g) =>
    [...g.items, ...g.subGroups.flatMap((s) => s.items)].map((item) => ({
      ...item,
      groupName: g.name,
      categoryLabel: categoryLabel(g.categoryId),
    }))
  );

  return { tabs, groups, searchable };
}

export interface MenuTreeState extends MenuTree {
  loading: boolean;
  error: string | null;
  source: "database" | "mock" | "unknown";
  reload: () => void;
}

export function useMenuTree(): MenuTreeState {
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
