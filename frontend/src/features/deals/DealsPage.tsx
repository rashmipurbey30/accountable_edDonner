import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useDeal, useDeals } from "../../api/hooks";
import type { Deal } from "../../api/types";
import { LateBadge, StageBadge } from "../../components/badges";
import { DataTable, type TableColumn } from "../../components/DataTable";
import { DeleteRecordDialog } from "../../components/DeleteRecordDialog";
import { Money } from "../../components/Money";
import { PageHeader } from "../../components/PageHeader";
import { Panel } from "../../components/Panel";
import { orDash } from "../../components/RecordHeader";
import { formatDate, percent } from "../../lib/format";
import { useListState } from "../../lib/urlState";
import { DealForm } from "./DealForm";

const DEFAULTS = { sort: "close_date" };

const COLUMNS: TableColumn<Deal>[] = [
  { id: "name", header: "Name", cell: (r) => r.name, className: "cell-name" },
  { id: "organization_name", header: "Organization", cell: (r) => r.organization_name },
  { id: "main_contact_name", header: "Main contact", cell: (r) => orDash(r.main_contact_name) },
  { id: "stage", header: "Stage", cell: (r) => <StageBadge value={r.stage} /> },
  { id: "value", header: "Value", cell: (r) => <Money value={r.value} />, numeric: true },
  { id: "probability", header: "Probability", cell: (r) => <span className="num">{percent(r.probability)}</span>, numeric: true },
  {
    id: "close_date",
    header: "Close date",
    numeric: true,
    cell: (r) =>
      r.close_date ? (
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          {r.is_late ? <LateBadge /> : null}
          <span className={`num${r.is_late ? " alert-text" : ""}`}>{formatDate(r.close_date)}</span>
        </span>
      ) : (
        orDash(null)
      ),
  },
];

export function DealsPage() {
  const [state, setState] = useListState(DEFAULTS);
  const list = useDeals(state);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<Deal | null>(null);
  const editing = useDeal(editingId);

  return (
    <>
      <PageHeader
        title="Deals"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> Add deal
          </button>
        }
      />
      <Panel flush>
        <DataTable<Deal>
          noun="deals"
          singular="deal"
          columns={COLUMNS}
          rows={list.data?.items}
          total={list.data?.total ?? 0}
          page={state.page}
          pageSize={25}
          sort={state.sort}
          dir={state.dir}
          q={state.q}
          onSort={(sort, dir) => setState({ sort, dir })}
          onPage={(page) => setState({ page })}
          onSearch={(q) => setState({ q })}
          onOpen={(row) => navigate(`/deals/${row.id}`)}
          onEdit={(row) => setEditingId(row.id)}
          onDelete={setDeleting}
          loading={list.isPending}
          error={list.isError}
          onRetry={() => list.refetch()}
        />
      </Panel>
      <DealForm open={adding} onOpenChange={setAdding} />
      <DealForm
        open={editingId !== null && !!editing.data}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
        deal={editing.data}
      />
      <DeleteRecordDialog kind="deal" record={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
