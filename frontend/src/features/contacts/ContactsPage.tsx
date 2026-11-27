import { Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useContacts } from "../../api/hooks";
import type { Contact, ContactStatus } from "../../api/types";
import { STATUSES, StatusBadge, statusName } from "../../components/badges";
import { DataTable, type TableColumn } from "../../components/DataTable";
import { DeleteRecordDialog } from "../../components/DeleteRecordDialog";
import { PageHeader } from "../../components/PageHeader";
import { Panel } from "../../components/Panel";
import { orDash } from "../../components/RecordHeader";
import { useListState } from "../../lib/urlState";
import { ContactForm } from "./ContactForm";

const DEFAULTS = { sort: "name" };

const COLUMNS: TableColumn<Contact>[] = [
  { id: "name", header: "Name", cell: (r) => r.name, className: "cell-name" },
  { id: "organization_name", header: "Organization", cell: (r) => orDash(r.organization_name) },
  { id: "job_title", header: "Job title", cell: (r) => orDash(r.job_title) },
  { id: "email", header: "Email", cell: (r) => orDash(r.email) },
  { id: "phone", header: "Phone", cell: (r) => (r.phone ? <span className="num">{r.phone}</span> : orDash(null)) },
  { id: "status", header: "Status", cell: (r) => <StatusBadge value={r.status} /> },
];

export function ContactsPage() {
  const [state, setState] = useListState(DEFAULTS);
  const list = useContacts(state);
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState<Contact | null>(null);
  const counts = list.data?.status_counts;

  const filter = (
    <div className="segmented" role="group" aria-label="Filter by status">
      {([["", "All", counts?.all], ...STATUSES.map((s) => [s, statusName(s), counts?.[s]])] as [
        ContactStatus | "",
        string,
        number | undefined,
      ][]).map(([value, label, count]) => (
        <button
          key={label}
          type="button"
          aria-pressed={state.status === value}
          onClick={() => setState({ status: value })}
        >
          {label}
          <span className="count">{count ?? "–"}</span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader
        title="Contacts"
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> Add contact
          </button>
        }
      />
      <Panel flush>
        <DataTable<Contact>
          noun="contacts"
          singular="contact"
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
          onOpen={(row) => navigate(`/contacts/${row.id}`)}
          onEdit={setEditing}
          onDelete={setDeleting}
          toolbar={filter}
          loading={list.isPending}
          error={list.isError}
          onRetry={() => list.refetch()}
        />
      </Panel>
      <ContactForm open={adding} onOpenChange={setAdding} />
      <ContactForm
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        contact={editing}
      />
      <DeleteRecordDialog kind="contact" record={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
