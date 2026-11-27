// Shapes from docs/plan.md (API). Dates are YYYY-MM-DD; times YYYY-MM-DDTHH:MM:SS.
import type { StageKey } from "../lib/stages";

export type ContactStatus = "lead" | "qualified" | "customer";
export type ActivityType = "note" | "call" | "email";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface Meta {
  today: string;
  now: string;
}

export interface Option {
  id: number;
  name: string;
  organization_name?: string | null;
}

export interface DealSummary {
  id: number;
  name: string;
  stage: StageKey;
  value: number;
  close_date: string | null;
  is_late: boolean;
}

export interface OrganizationRow {
  id: number;
  name: string;
  industry: string | null;
  website: string | null;
  contacts_count: number;
  deals_count: number;
  open_value: number;
}

export interface Organization {
  id: number;
  name: string;
  website: string | null;
  industry: string | null;
  notes: string | null;
}

export interface OrganizationDetail extends Organization {
  contacts: { id: number; name: string; job_title: string | null; status: ContactStatus }[];
  deals: DealSummary[];
}

export interface OrganizationInput {
  name: string;
  website?: string | null;
  industry?: string | null;
  notes?: string | null;
}

export interface Contact {
  id: number;
  name: string;
  organization_id: number | null;
  organization_name: string | null;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  status: ContactStatus;
}

export interface ContactPage extends Page<Contact> {
  status_counts: { all: number; lead: number; qualified: number; customer: number };
}

export interface ContactDetail extends Contact {
  deals: DealSummary[];
}

export interface ContactInput {
  name: string;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  organization_id?: number | null;
  status: ContactStatus;
}

export interface Deal {
  id: number;
  name: string;
  organization_id: number;
  organization_name: string;
  main_contact_id: number | null;
  main_contact_name: string | null;
  stage: StageKey;
  value: number;
  probability: number;
  close_date: string | null;
  is_late: boolean;
}

export interface DealDetail extends Deal {
  lost_reason: string | null;
}

export interface DealInput {
  name: string;
  organization_id: number;
  main_contact_id?: number | null;
  stage: StageKey;
  value: number;
  probability?: number;
  close_date?: string | null;
  lost_reason?: string | null;
}

export interface DeleteImpact {
  contacts?: number;
  deals?: number;
  activities?: number;
}

export interface Card {
  id: number;
  name: string;
  organization_name: string;
  value: number;
  probability: number;
  close_date: string | null;
  is_late: boolean;
  main_contact_initials: string | null;
  lost_reason: string | null;
}

export interface Column {
  stage: StageKey;
  count: number;
  value: number;
  expected: number;
  deals: Card[];
}

export interface Board {
  totals: { open_value: number; open_expected: number; open_count: number };
  columns: Column[];
}

export interface MoveInput {
  stage: StageKey;
  before_id: number | null;
  lost_reason?: string | null;
}

export interface Activity {
  id: number;
  type: ActivityType;
  description: string;
  occurred_at: string;
  follow_up_date: string | null;
  done: boolean;
  contact_id: number | null;
  deal_id: number | null;
}

export interface ActivityInput {
  type: ActivityType;
  description: string;
  occurred_at: string;
  follow_up_date?: string | null;
  contact_id?: number | null;
  deal_id?: number | null;
}

export interface TimelineItem {
  kind: "activity" | "stage_change";
  id: number;
  type: ActivityType | "stage";
  text: string;
  at: string;
  follow_up_date: string | null;
  done: boolean;
  overdue: boolean;
  source: { kind: "deal"; id: number; name: string } | null;
}

export interface LinkedRecord {
  kind: "contact" | "deal";
  id: number;
  name: string;
}

export interface FollowUp {
  id: number;
  description: string;
  follow_up_date: string;
  overdue: boolean;
  on: LinkedRecord;
}

export interface MonthFigures {
  label: string;
  revenue: number;
  running_total: number;
  won: number;
  lost: number;
}

export interface StageFigures {
  stage: StageKey;
  count: number;
  value: number;
  expected: number;
}

export interface Dashboard {
  today: string;
  months: MonthFigures[];
  revenue_won: number;
  deals_won: number;
  deals_lost: number;
  win_rate: number | null;
  average_won: number | null;
  best_month: { label: string; revenue: number; deals: number } | null;
  open: { value: number; expected: number; count: number; late: number; by_stage: StageFigures[] };
  funnel: { stage: StageKey; deals: number; value: number }[];
  follow_ups: { items: FollowUp[]; overdue_count: number; total_open: number };
  recent: {
    kind: "activity" | "stage_change";
    id: number;
    type: ActivityType | "stage";
    text: string;
    at: string;
    on: LinkedRecord;
  }[];
}
