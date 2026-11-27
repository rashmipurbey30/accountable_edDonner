import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import type { ListState } from "../lib/urlState";
import { api } from "./client";
import type {
  Activity,
  ActivityInput,
  Board,
  Contact,
  ContactDetail,
  ContactInput,
  ContactPage,
  Dashboard,
  Deal,
  DealDetail,
  DealInput,
  DeleteImpact,
  FollowUp,
  Meta,
  Option,
  Organization,
  OrganizationDetail,
  OrganizationInput,
  OrganizationRow,
  Page,
  TimelineItem,
} from "./types";

export type RecordKind = "organization" | "contact" | "deal" | "activity";

const LABELS: Record<RecordKind, string> = {
  organization: "Organization",
  contact: "Contact",
  deal: "Deal",
  activity: "Activity",
};

// Cache invalidation, from docs/plan.md. Each entry is a query key prefix.
// Deal changes also refresh timelines, since a deal's timeline shows its stage changes.
const INVALIDATES: Record<RecordKind, string[]> = {
  organization: ["organizations", "organization", "contacts", "contact", "deals", "deal", "pipeline", "dashboard", "options"],
  contact: ["contacts", "contact", "deals", "deal", "organization", "organizations", "dashboard", "timeline", "options"],
  deal: ["deals", "deal", "pipeline", "dashboard", "organizations", "organization", "contact", "timeline", "follow-ups"],
  activity: ["timeline", "dashboard", "follow-ups"],
};

/**
 * Refresh what a change affects. `deletedId` skips the deleted record's own queries
 * (its page and timeline), which would only 404 while its page closes.
 */
export function invalidateFor(client: QueryClient, kind: RecordKind, deletedId?: number) {
  const isDeleted = (key: readonly unknown[]) =>
    deletedId !== undefined &&
    ((key[0] === kind && key[1] === deletedId) || (key[0] === "timeline" && key[1] === kind && key[2] === deletedId));
  return Promise.all(
    INVALIDATES[kind].map((prefix) =>
      client.invalidateQueries({ predicate: (q) => q.queryKey[0] === prefix && !isDeleted(q.queryKey) }),
    ),
  );
}

function listQuery(state: ListState) {
  return { q: state.q, sort: state.sort, dir: state.dir, page: state.page };
}

/* Meta: the backend's today and now (ground rule 6). */

export function useMeta() {
  return useQuery({
    queryKey: ["meta"],
    queryFn: () => api.get<Meta>("/meta"),
    staleTime: 60_000,
  });
}

export function useToday(): string | undefined {
  return useMeta().data?.today;
}

/* Lists */

export function useOrganizations(state: ListState) {
  return useQuery({
    queryKey: ["organizations", listQuery(state)],
    queryFn: () => api.get<Page<OrganizationRow>>("/organizations", listQuery(state)),
    placeholderData: keepPreviousData,
  });
}

export function useContacts(state: ListState) {
  const query = { ...listQuery(state), status: state.status };
  return useQuery({
    queryKey: ["contacts", query],
    queryFn: () => api.get<ContactPage>("/contacts", query),
    placeholderData: keepPreviousData,
  });
}

export function useDeals(state: ListState) {
  return useQuery({
    queryKey: ["deals", listQuery(state)],
    queryFn: () => api.get<Page<Deal>>("/deals", listQuery(state)),
    placeholderData: keepPreviousData,
  });
}

/* Records */

export function isId(id: number | null): id is number {
  return id !== null && Number.isInteger(id) && id > 0;
}

/** One organization, or nothing while `id` is null. */
export function useOrganization(id: number | null) {
  return useQuery({
    queryKey: ["organization", id],
    queryFn: () => api.get<OrganizationDetail>(`/organizations/${id}`),
    enabled: isId(id),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  });
}

/** One contact, or nothing while `id` is null. */
export function useContact(id: number | null) {
  return useQuery({
    queryKey: ["contact", id],
    queryFn: () => api.get<ContactDetail>(`/contacts/${id}`),
    enabled: isId(id),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  });
}

/** One deal, or nothing while `id` is null. */
export function useDeal(id: number | null) {
  return useQuery({
    queryKey: ["deal", id],
    queryFn: () => api.get<DealDetail>(`/deals/${id}`),
    enabled: isId(id),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  });
}

export function useTimeline(kind: "contact" | "deal", id: number) {
  return useQuery({
    queryKey: ["timeline", kind, id],
    queryFn: () => api.get<TimelineItem[]>(`/${kind}s/${id}/timeline`),
  });
}

const PATHS: Record<Exclude<RecordKind, "activity">, string> = {
  organization: "/organizations",
  contact: "/contacts",
  deal: "/deals",
};

export function useDeleteImpact(kind: Exclude<RecordKind, "activity">, id: number | null) {
  return useQuery({
    queryKey: ["delete-impact", kind, id],
    queryFn: () => api.get<DeleteImpact>(`${PATHS[kind]}/${id}/delete-impact`),
    enabled: id !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

/* Options for pickers */

export function loadOrganizationOptions(q: string) {
  return api.get<Option[]>("/organizations/options", { q });
}

export function loadContactOptions(q: string, organizationId?: number | null) {
  return api.get<Option[]>("/contacts/options", { q, organization_id: organizationId ?? undefined });
}

/* Pipeline and dashboard */

export function usePipeline() {
  return useQuery({ queryKey: ["pipeline"], queryFn: () => api.get<Board>("/pipeline") });
}

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<Dashboard>("/dashboard") });
}

export function useFollowUps(enabled: boolean) {
  return useQuery({
    queryKey: ["follow-ups"],
    queryFn: () => api.get<FollowUp[]>("/follow-ups"),
    enabled,
  });
}

/* Mutations. Each toasts and invalidates what it affects (Messages, Cache invalidation). */

interface SaveVars<TInput> {
  id?: number;
  input: Partial<TInput>;
}

function useSave<TInput, TResult>(kind: RecordKind, path: string, opts: { quiet?: boolean } = {}) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: SaveVars<TInput>) =>
      id === undefined ? api.post<TResult>(path, input) : api.patch<TResult>(`${path}/${id}`, input),
    onSuccess: async () => {
      if (!opts.quiet) toast.success(`${LABELS[kind]} saved`);
      await invalidateFor(client, kind);
    },
    onError: () => {
      toast.error(`Couldn't save the ${kind}. Try again.`);
    },
  });
}

function useRemove(kind: RecordKind, path: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`${path}/${id}`),
    onSuccess: async (_data, id) => {
      toast.success(`${LABELS[kind]} deleted`);
      await invalidateFor(client, kind, id);
    },
    onError: () => {
      toast.error(`Couldn't delete the ${kind}. Try again.`);
    },
  });
}

export const useSaveOrganization = () => useSave<OrganizationInput, Organization>("organization", "/organizations");
export const useDeleteOrganization = () => useRemove("organization", "/organizations");
export const useSaveContact = () => useSave<ContactInput, Contact>("contact", "/contacts");
export const useDeleteContact = () => useRemove("contact", "/contacts");
export const useSaveDeal = () => useSave<DealInput, DealDetail>("deal", "/deals");
export const useDeleteDeal = () => useRemove("deal", "/deals");
export const useSaveActivity = () => useSave<ActivityInput, Activity>("activity", "/activities");
export const useDeleteActivity = () => useRemove("activity", "/activities");

/**
 * Ticking a follow-up's done box: no toast, the checkbox is the feedback, so it ticks
 * at once in every cached timeline and goes back if the save fails.
 */
export function useSetDone() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, done }: { id: number; done: boolean }) =>
      api.patch<Activity>(`/activities/${id}`, { done }),
    onMutate: async ({ id, done }) => {
      await client.cancelQueries({ queryKey: ["timeline"] });
      const previous = client.getQueriesData<TimelineItem[]>({ queryKey: ["timeline"] });
      client.setQueriesData<TimelineItem[]>({ queryKey: ["timeline"] }, (items) =>
        items?.map((item) =>
          item.kind === "activity" && item.id === id ? { ...item, done, overdue: done ? false : item.overdue } : item,
        ),
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      for (const [key, data] of context?.previous ?? []) client.setQueryData(key, data);
      toast.error("Couldn't save the activity. Try again.");
    },
    onSettled: () => invalidateFor(client, "activity"),
  });
}
