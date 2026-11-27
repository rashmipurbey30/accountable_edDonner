import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { renderWithProviders } from "../test/render";
import { DataTable, type TableColumn } from "./DataTable";

interface Row {
  id: number;
  name: string;
  email: string;
}

const columns: TableColumn<Row>[] = [
  { id: "name", header: "Name", cell: (r) => r.name },
  { id: "email", header: "Email", cell: (r) => r.email },
];

const rows: Row[] = [
  { id: 1, name: "Ann Smith", email: "ann@example.com" },
  { id: 2, name: "Bob Jones", email: "bob@example.com" },
];

function setup(overrides: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  const props = {
    noun: "contacts",
    singular: "contact",
    columns,
    rows,
    total: 312,
    page: 2,
    pageSize: 25,
    sort: "name",
    dir: "asc" as const,
    q: "",
    onSort: vi.fn(),
    onPage: vi.fn(),
    onSearch: vi.fn(),
    onOpen: vi.fn(),
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  const view = renderWithProviders(<DataTable<Row> {...props} />);
  return { props, view };
}

describe("DataTable", () => {
  test("clicking a heading sorts ascending, and again descending (T2)", async () => {
    const user = userEvent.setup();
    const { props, view } = setup();
    await user.click(screen.getByRole("button", { name: /email/i }));
    expect(props.onSort).toHaveBeenLastCalledWith("email", "asc");

    view.rerender(<DataTable<Row> {...props} sort="email" dir="asc" />);
    await user.click(screen.getByRole("button", { name: /email/i }));
    expect(props.onSort).toHaveBeenLastCalledWith("email", "desc");
    expect(screen.getByRole("columnheader", { name: /email/i })).toHaveAttribute("aria-sort", "ascending");
  });

  test("the paging bar reads 'Showing 26–50 of 312' (T3)", async () => {
    const user = userEvent.setup();
    const { props } = setup();
    expect(screen.getByText("Showing 26–50 of 312")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 13")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(props.onPage).toHaveBeenCalledWith(3);
  });

  test("Previous is disabled on page 1 (T3)", () => {
    setup({ page: 1 });
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  test("the empty state names the search and clears it (T8)", async () => {
    const user = userEvent.setup();
    const { props } = setup({ rows: [], total: 0, q: "zz" });
    expect(screen.getByText("No contacts match 'zz'")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(props.onSearch).toHaveBeenCalledWith("");
  });

  test("a row click opens the record, and the row menu doesn't (T5)", async () => {
    const user = userEvent.setup();
    const { props } = setup();
    await user.click(screen.getByText("bob@example.com"));
    expect(props.onOpen).toHaveBeenCalledWith(rows[1]);

    vi.mocked(props.onOpen).mockClear();
    await user.click(screen.getByRole("button", { name: "Actions for contact Ann Smith" }));
    expect(props.onOpen).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("menuitem", { name: "Edit" }));
    expect(props.onEdit).toHaveBeenCalledWith(rows[0]);
    expect(props.onOpen).not.toHaveBeenCalled();
  });

  test("typing searches after a pause (T1)", async () => {
    const user = userEvent.setup();
    const { props } = setup();
    await user.type(screen.getByRole("searchbox", { name: "Search contacts" }), "ann");
    expect(props.onSearch).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(props.onSearch).toHaveBeenCalledWith("ann"), { timeout: 1000 });
    expect(props.onSearch).toHaveBeenCalledTimes(1);
  });
});
