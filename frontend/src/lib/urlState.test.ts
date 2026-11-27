import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { expect, test } from "vitest";
import { useListState } from "./urlState";

const DEFAULTS = { sort: "name" };

function setup(url: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    createElement(MemoryRouter, { initialEntries: [url] }, children)
  );
  return renderHook(
    () => {
      const [state, set] = useListState(DEFAULTS);
      const location = useLocation();
      return { state, set, search: location.search };
    },
    { wrapper },
  );
}

test("reads q, sort, dir, page and status from the URL (T7)", () => {
  const { result } = setup("/contacts?q=ann&sort=email&dir=desc&page=3&status=lead");
  expect(result.current.state).toEqual({ q: "ann", sort: "email", dir: "desc", page: 3, status: "lead" });
});

test("falls back to defaults", () => {
  const { result } = setup("/contacts?page=abc&dir=up");
  expect(result.current.state).toEqual({ q: "", sort: "name", dir: "asc", page: 1, status: "" });
});

test.each([
  [{ q: "zz" }],
  [{ sort: "email" }],
  [{ status: "customer" }],
])("changing %o resets page to 1 (T3)", (change) => {
  const { result } = setup("/contacts?page=4");
  act(() => result.current.set(change));
  expect(result.current.state.page).toBe(1);
  expect(result.current.search).not.toContain("page=");
});

test("changing page keeps the rest", () => {
  const { result } = setup("/contacts?q=ann&status=lead");
  act(() => result.current.set({ page: 2 }));
  expect(result.current.state).toMatchObject({ q: "ann", status: "lead", page: 2 });
});
