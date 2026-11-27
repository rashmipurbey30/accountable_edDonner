import {
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from "lucide-react";
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import type { Dir } from "../lib/urlState";
import { useDebounced } from "../lib/useDebounced";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { RowMenu } from "./RowMenu";

export interface TableColumn<T> {
  /** Also the server's sort key. */
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  numeric?: boolean;
  className?: string;
}

interface DataTableProps<T extends { id: number; name: string }> {
  /** Plural noun for the empty state: "contacts". */
  noun: string;
  /** Singular noun for the row menu label: "contact". */
  singular: string;
  columns: TableColumn<T>[];
  rows: T[] | undefined;
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: Dir;
  q: string;
  onSort: (sort: string, dir: Dir) => void;
  onPage: (page: number) => void;
  onSearch: (q: string) => void;
  onOpen: (row: T) => void;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  toolbar?: ReactNode;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
}

const features = tableFeatures({ rowSortingFeature });

/**
 * One table for the three lists. TanStack Table in manual mode: the server searches,
 * sorts and pages (T1 to T8); this shows the result and reports what the user asked for.
 */
export function DataTable<T extends { id: number; name: string }>(props: DataTableProps<T>) {
  const { noun, singular, columns, rows, total, page, pageSize, sort, dir, q } = props;
  const [text, setText] = useState(q);
  const settled = useDebounced(text, 250);

  // The URL can change the search too (the empty state's clear button, Back).
  useEffect(() => setText(q), [q]);
  useEffect(() => {
    if (settled !== q) props.onSearch(settled);
    // Only react to the typed text settling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);

  const defs = useMemo<ColumnDef<typeof features, T>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        header: c.header,
        accessorFn: (row: T) => row[c.id as keyof T],
        cell: (ctx) => c.cell(ctx.row.original),
        enableSorting: c.sortable !== false,
      })),
    [columns],
  );
  const sorting: SortingState = useMemo(() => [{ id: sort, desc: dir === "desc" }], [sort, dir]);
  const data = useMemo(() => rows ?? [], [rows]);
  const table = useTable({
    features,
    columns: defs,
    data,
    state: { sorting },
    onSortingChange: () => {},
    manualSorting: true,
    getRowId: (row) => String(row.id),
  });

  const byId = Object.fromEntries(columns.map((c) => [c.id, c]));
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const toggle = (id: string) => props.onSort(id, sort === id && dir === "asc" ? "desc" : "asc");
  const openOnEnter = (e: KeyboardEvent, row: T) => {
    if (e.key === "Enter") props.onOpen(row);
  };

  let body: ReactNode;
  if (props.error) {
    body = <ErrorState onRetry={props.onRetry} />;
  } else if (rows && rows.length === 0) {
    body = q ? (
      <EmptyState
        message={`No ${noun} match '${q}'`}
        action={
          <button type="button" className="btn" onClick={() => props.onSearch("")}>
            Clear search
          </button>
        }
      />
    ) : (
      <EmptyState message={`No ${noun} yet.`} />
    );
  }

  return (
    <>
      <div className="table-toolbar">
        <div className="search">
          <Search aria-hidden="true" />
          <input
            className="input"
            type="search"
            aria-label={`Search ${noun}`}
            placeholder={`Search ${noun}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        {props.toolbar}
      </div>
      {body ?? (
        <div className="table-wrap">
          <table className="data">
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id}>
                  {group.headers.map((header) => {
                    const col = byId[header.column.id];
                    const sorted = header.column.getIsSorted();
                    const ariaSort = sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined;
                    return (
                      <th key={header.id} className={col.numeric ? "numeric" : undefined} aria-sort={ariaSort}>
                        {header.column.getCanSort() ? (
                          <button type="button" className="sort-btn" onClick={() => toggle(col.id)}>
                            {col.header}
                            {sorted === "asc" ? (
                              <ArrowUp aria-hidden="true" />
                            ) : sorted === "desc" ? (
                              <ArrowDown aria-hidden="true" />
                            ) : (
                              <ChevronsUpDown aria-hidden="true" style={{ opacity: 0.45 }} />
                            )}
                          </button>
                        ) : (
                          col.header
                        )}
                      </th>
                    );
                  })}
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              ))}
            </thead>
            <tbody>
              {props.loading && !rows
                ? Array.from({ length: 8 }, (_, i) => (
                    <tr key={i} aria-hidden="true">
                      {columns.map((c) => (
                        <td key={c.id}>
                          <span className="skeleton" style={{ width: c.numeric ? 60 : 120 }} />
                        </td>
                      ))}
                      <td />
                    </tr>
                  ))
                : table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() => props.onOpen(row.original)}
                      onKeyDown={(e) => openOnEnter(e, row.original)}
                    >
                      {row.getAllCells().map((cell) => {
                        const col = byId[cell.column.id];
                        const classes = [col.numeric ? "numeric" : "", col.className ?? ""].join(" ").trim();
                        return (
                          <td key={cell.id} className={classes || undefined}>
                            <table.FlexRender cell={cell} />
                          </td>
                        );
                      })}
                      <td className="menu-cell">
                        <RowMenu
                          label={`Actions for ${singular} ${row.original.name}`}
                          onEdit={() => props.onEdit(row.original)}
                          onDelete={() => props.onDelete(row.original)}
                        />
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="paging">
        <span className="num">
          {total === 0 ? "Showing 0" : `Showing ${from}–${to} of ${total.toLocaleString("en-US")}`}
        </span>
        <div className="pager">
          <button type="button" className="btn btn-small" disabled={page <= 1} onClick={() => props.onPage(page - 1)}>
            Previous
          </button>
          <span className="num">
            Page {page} of {pages}
          </span>
          <button
            type="button"
            className="btn btn-small"
            disabled={page >= pages}
            onClick={() => props.onPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
