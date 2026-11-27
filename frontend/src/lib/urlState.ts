import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

export type Dir = "asc" | "desc";

export interface ListState {
  q: string;
  sort: string;
  dir: Dir;
  page: number;
  status: string;
}

export interface ListStateDefaults {
  sort: string;
  dir?: Dir;
}

/** Search, sort, page and status live in the URL, so a refresh keeps them (T7). */
export function readListState(params: URLSearchParams, defaults: ListStateDefaults): ListState {
  const page = Number(params.get("page"));
  const dir = params.get("dir");
  return {
    q: params.get("q") ?? "",
    sort: params.get("sort") || defaults.sort,
    dir: dir === "asc" || dir === "desc" ? dir : defaults.dir ?? "asc",
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    status: params.get("status") ?? "",
  };
}

/** Changing q, sort, dir or status goes back to page 1 (T3). */
export function applyListChange(params: URLSearchParams, change: Partial<ListState>): URLSearchParams {
  const next = new URLSearchParams(params);
  const resets = ["q", "sort", "dir", "status"].some((k) => k in change);
  for (const [key, value] of Object.entries(change)) {
    if (value === "" || value === undefined || (key === "page" && value === 1)) next.delete(key);
    else next.set(key, String(value));
  }
  if (resets && !("page" in change)) next.delete("page");
  return next;
}

export function useListState(defaults: ListStateDefaults) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(() => readListState(params, defaults), [params, defaults]);
  const set = useCallback(
    (change: Partial<ListState>) => {
      // Typing in the search box replaces the entry, so Back doesn't step through each letter.
      setParams((current) => applyListChange(current, change), { replace: "q" in change });
    },
    [setParams],
  );
  return [state, set] as const;
}
