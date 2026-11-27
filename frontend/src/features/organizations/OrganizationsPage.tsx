import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useOrganization, useOrganizations } from "../../api/hooks";
import type { OrganizationRow } from "../../api/types";
import { DataTable, type TableColumn } from "../../components/DataTable";
import { DeleteRecordDialog } from "../../components/DeleteRecordDialog";
import { Money } from "../../components/Money";
import { PageHeader } from "../../components/PageHeader";
import { Panel } from "../../components/Panel";
import { orDash } from "../../components/RecordHeader";
import { useListState } from "../../lib/urlState";
import { OrganizationForm } from "./OrganizationForm";

const DEFAULTS = { sort: "name" };

const COLUMNS: TableColumn<OrganizationRow>[] = [
  { id: "name", header: "Name", cell: (r) => r.name, className: "cell-name" },
  { id: "industry", header: "Industry", cell: (r) => orDash(r.industry) },
  { id: "website", header: "Website", cell: (r) => orDash(r.website) },
  { id: "contacts_count", header: "Contacts", cell: (r) => <span className="num">{r.contacts_count}</span>, numeric: true },
  { id: "deals_count", header: "Deals", cell: (r) => <span className="num">{r.deals_count}</span>, numeric: true },
  { id: "open_value", header: "Open pipeline", cell: (r) => <Money value={r.open_value} />, numeric: true },
];

export function OrganizationsPage() {
  const [state, setState] = useListState(DEFAULTS);
  const list = useOrganizations(state);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<OrganizationRow | null>(null);
  const editing = useOrganization(editingId);

  return (
    <>
      <PageHeader
        title="Organizations"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> Add organization
          </button>
        }
      />
      <Panel flush>
        <DataTable<OrganizationRow>
          noun="organizations"
          singular="organization"
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
          onOpen={(row) => navigate(`/organizations/${row.id}`)}
          onEdit={(row) => setEditingId(row.id)}
          onDelete={setDeleting}
          loading={list.isPending}
          error={list.isError}
          onRetry={() => list.refetch()}
        />
      </Panel>
      <OrganizationForm open={adding} onOpenChange={setAdding} />
      <OrganizationForm
        open={editingId !== null && !!editing.data}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
        organization={editing.data}
      />
      <DeleteRecordDialog kind="organization" record={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
