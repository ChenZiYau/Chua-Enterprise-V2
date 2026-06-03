"use client";

import { useEffect, useMemo, useState } from "react";
import { IconMaintenance, IconSearch } from "@/components/admin/icons";
import { OverviewCard } from "@/components/admin/OverviewCard";
import { useRental } from "@/context/RentalContext";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { notionCreate, notionUpdate, notionDelete, isNotionId } from "@/lib/notionClient";
import { todayIso as getTodayIso, startOfDay, daysAgoIso } from "@/lib/date";
import type { MaintenanceEntry } from "@/types/rental";

type MaintenanceStatus = "pending" | "in_progress" | "completed";
type MaintenancePriority = "low" | "medium" | "high" | "urgent";
type MaintenanceTab = "all" | MaintenanceStatus | "overdue";
type DialogMode = "new" | "view" | "edit";
type DrawerView = "normal" | "expanded" | "minimized";

type MaintenanceCase = {
  id: string;
  property: string;
  unit: string;
  tenant: string;
  issue: string;
  category: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedDate: string;
  startDate: string;
  durationDays: number;
  dueDate: string;
  assignedTo: string;
  description: string;
};

type MaintenanceApiRow = {
  id: string;
  name: string;
  property: string;
  unit: string;
  tenant: string;
  category: string;
  priority: string;
  status: string;
  reportedDate: string;
  dueDate: string;
  assignedTo: string;
  description: string;
};

type MaintenanceFormState = {
  propertyId: string;
  unitId: string;
  tenantId: string;
  property: string;
  unit: string;
  tenant: string;
  issue: string;
  category: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedDate: string;
  startDate: string;
  durationDays: string;
  assignedTo: string;
  description: string;
  manuallyUrgent: boolean;
};

const statusLabels: Record<MaintenanceStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

const priorityLabels: Record<MaintenancePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const tabs: { value: MaintenanceTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "overdue", label: "Overdue" },
];

// Mirrors the Category select options in the Notion maintenance database.
const MAINTENANCE_CATEGORIES = [
  "Air Conditioning",
  "Plumbing",
  "Electrical",
  "Security",
  "Waterproofing",
  "Carpentry",
  "Painting",
  "Appliance",
  "Other",
];

const NOTION_STATUS: Record<MaintenanceStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};
const NOTION_PRIORITY: Record<MaintenancePriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const emptyForm: MaintenanceFormState = {
  propertyId: "",
  unitId: "",
  tenantId: "",
  property: "",
  unit: "",
  tenant: "",
  issue: "",
  category: "Other",
  priority: "medium",
  status: "pending",
  reportedDate: getTodayIso(),
  startDate: getTodayIso(),
  durationDays: "3",
  assignedTo: "",
  description: "",
  manuallyUrgent: false,
};

function normalizeStatus(value: string): MaintenanceStatus {
  const v = value.trim().toLowerCase();
  if (v === "in progress" || v === "in_progress") return "in_progress";
  if (v === "completed") return "completed";
  return "pending";
}

function normalizePriority(value: string): MaintenancePriority {
  const v = value.trim().toLowerCase();
  if (v === "urgent") return "urgent";
  if (v === "high") return "high";
  if (v === "medium") return "medium";
  return "low";
}

function addDays(date: string, days: number) {
  const todayIso = getTodayIso();
  const d = new Date(`${date || todayIso}T00:00:00`);
  d.setDate(d.getDate() + Math.max(days, 0));
  return d.toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  const todayIso = getTodayIso();
  const startTime = new Date(`${start || todayIso}T00:00:00`).getTime();
  const endTime = new Date(`${end || start || todayIso}T00:00:00`).getTime();
  const diff = Math.round((endTime - startTime) / (1000 * 60 * 60 * 24));
  return Math.max(diff, 0);
}

function mapRow(row: MaintenanceApiRow): MaintenanceCase {
  const todayIso = getTodayIso();
  const reportedDate = row.reportedDate || todayIso;
  const dueDate = row.dueDate || reportedDate;
  return {
    id: row.id,
    property: row.property,
    unit: row.unit,
    tenant: row.tenant,
    issue: row.name,
    category: row.category || "Other",
    priority: normalizePriority(row.priority),
    status: normalizeStatus(row.status),
    reportedDate,
    startDate: reportedDate,
    durationDays: daysBetween(reportedDate, dueDate),
    dueDate,
    assignedTo: row.assignedTo || "Unassigned",
    description: row.description,
  };
}

function isOverdue(item: MaintenanceCase) {
  const today = startOfDay(getTodayIso());
  return item.status !== "completed" && new Date(`${item.dueDate}T00:00:00`) < today;
}

function isUrgentOrOverdue(item: MaintenanceCase) {
  return item.status !== "completed" && (item.priority === "urgent" || isOverdue(item));
}

function formatDate(value: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function statusChipClass(status: MaintenanceStatus) {
  if (status === "completed") return "ui-chip-success";
  if (status === "in_progress") return "ui-chip-warning";
  return "";
}

function priorityChipClass(priority: MaintenancePriority) {
  if (priority === "urgent" || priority === "high") return "ui-chip-danger";
  if (priority === "medium") return "ui-chip-warning";
  return "";
}

function formFromCase(item: MaintenanceCase): MaintenanceFormState {
  return {
    propertyId: "",
    unitId: "",
    tenantId: "",
    property: item.property,
    unit: item.unit,
    tenant: item.tenant,
    issue: item.issue,
    category: item.category,
    priority: item.priority,
    status: item.status,
    reportedDate: item.reportedDate,
    startDate: item.startDate,
    durationDays: String(item.durationDays || daysBetween(item.startDate, item.dueDate) || 1),
    assignedTo: item.assignedTo,
    description: item.description,
    manuallyUrgent: item.priority === "urgent",
  };
}

function caseFromForm(form: MaintenanceFormState, id: string): MaintenanceCase {
  const todayIso = getTodayIso();
  const duration = Math.max(Number(form.durationDays) || 0, 0);
  const priority = form.manuallyUrgent ? "urgent" : form.priority;
  return {
    id,
    property: form.property.trim() || "Unassigned Property",
    unit: form.unit.trim() || "Unassigned Unit",
    tenant: form.tenant.trim() || "Unassigned Tenant",
    issue: form.issue.trim() || "Untitled maintenance case",
    category: form.category.trim() || "Other",
    priority,
    status: form.status,
    reportedDate: form.reportedDate || todayIso,
    startDate: form.startDate || form.reportedDate || todayIso,
    durationDays: duration,
    dueDate: addDays(form.startDate || form.reportedDate || todayIso, duration),
    assignedTo: form.assignedTo.trim() || "Unassigned",
    description: form.description.trim() || "No description added.",
  };
}

function toMaintenanceEntry(item: MaintenanceCase): MaintenanceEntry {
  return {
    id: item.id,
    property: item.property,
    unit: item.unit,
    tenant: item.tenant,
    issue: item.issue,
    category: item.category,
    priority: item.priority,
    status: item.status,
    reported_date: item.reportedDate,
    due_date: item.dueDate,
    assigned_to: item.assignedTo,
    description: item.description,
    created_at: new Date().toISOString(),
  };
}

export default function MaintenancePage() {
  const {
    visibleProperties,
    units,
    tenants,
    setMaintenanceEntriesFromPage,
    upsertMaintenanceEntry,
    removeMaintenanceEntry,
  } = useRental();
  const todayIso = getTodayIso();
  const [cases, setCases] = useState<MaintenanceCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<MaintenanceTab>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MaintenanceStatus | "all">("all");
  const [priority, setPriority] = useState<MaintenancePriority | "all">("all");
  const [property, setProperty] = useState("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "overdue">("all");

  const [dialogMode, setDialogMode] = useState<DialogMode | null>(null);
  const [selectedCase, setSelectedCase] = useState<MaintenanceCase | null>(null);
  const [form, setForm] = useState<MaintenanceFormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notion/maintenance", { cache: "no-store" });
        const json = (await res.json()) as { data?: MaintenanceApiRow[]; error?: string };
        if (cancelled) return;
        if (!res.ok || json.error) {
          setLoadError(json.error || `Request failed (${res.status})`);
          setCases([]);
        } else {
          const nextCases = (json.data ?? []).map(mapRow);
          setCases(nextCases);
          setMaintenanceEntriesFromPage(nextCases.map(toMaintenanceEntry));
          setLoadError(null);
        }
      } catch (err) {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : String(err));
        setCases([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const propertyOptions = useMemo(() => {
    const names = new Set(cases.map((item) => item.property).filter(Boolean));
    visibleProperties.forEach((item) => names.add(item.name));
    return Array.from(names).sort();
  }, [cases, visibleProperties]);

  const counts = useMemo(() => {
    const pending = cases.filter((item) => item.status === "pending").length;
    const inProgress = cases.filter((item) => item.status === "in_progress").length;
    const completed = cases.filter((item) => item.status === "completed").length;
    const urgentOverdue = cases.filter(isUrgentOrOverdue).length;
    return { pending, inProgress, completed, urgentOverdue };
  }, [cases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cases.filter((item) => {
      if (activeTab === "overdue" && !isUrgentOrOverdue(item)) return false;
      if (activeTab !== "all" && activeTab !== "overdue" && item.status !== activeTab) return false;
      if (status !== "all" && item.status !== status) return false;
      if (priority !== "all" && item.priority !== priority) return false;
      if (property !== "all" && item.property !== property) return false;
      if (dateRange === "today" && item.reportedDate !== todayIso) return false;
      if (dateRange === "week" && startOfDay(item.reportedDate) < startOfDay(daysAgoIso(6))) {
        return false;
      }
      if (dateRange === "overdue" && !isUrgentOrOverdue(item)) return false;
      if (!q) return true;
      return (
        item.property.toLowerCase().includes(q) ||
        item.unit.toLowerCase().includes(q) ||
        item.issue.toLowerCase().includes(q) ||
        item.tenant.toLowerCase().includes(q) ||
        item.assignedTo.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [cases, activeTab, dateRange, priority, property, search, status]);

  const hasFilters =
    search ||
    activeTab !== "all" ||
    status !== "all" ||
    priority !== "all" ||
    property !== "all" ||
    dateRange !== "all";

  function applyQuickFilter(tab: MaintenanceTab) {
    setActiveTab(tab);
    setSearch("");
    setStatus("all");
    setPriority("all");
    setProperty("all");
    setDateRange("all");
  }

  function resetFilters() {
    applyQuickFilter("all");
  }

  function openNewCase() {
    setSelectedCase(null);
    setForm({ ...emptyForm, reportedDate: todayIso, startDate: todayIso });
    setFormError(null);
    setDialogMode("new");
  }

  // Validate the form before persisting (#14: no blank/orphan records).
  function validateForm(f: MaintenanceFormState): string | null {
    if (!f.issue.trim()) return "Enter an issue title.";
    if (!f.property.trim()) return "Select a property.";
    if (!f.unit.trim()) return "Select a unit.";
    if ((Number(f.durationDays) || 0) < 1) return "Estimated duration must be at least 1 day.";
    return null;
  }

  function notionFieldsFromCase(c: MaintenanceCase) {
    return {
      name: c.issue,
      property: c.property,
      unit: c.unit,
      tenant: c.tenant,
      category: c.category,
      priority: NOTION_PRIORITY[c.priority],
      status: NOTION_STATUS[c.status],
      reportedDate: c.reportedDate,
      dueDate: c.dueDate,
      assignedTo: c.assignedTo,
      description: c.description,
    };
  }

  function openViewCase(item: MaintenanceCase) {
    setSelectedCase(item);
    setDialogMode("view");
  }

  function openEditCase(item: MaintenanceCase) {
    setSelectedCase(item);
    const next = formFromCase(item);
    const matchedProperty = visibleProperties.find((property) => property.name === item.property);
    const matchedUnit = units.find(
      (unit) =>
        unit.name === item.unit &&
        (!matchedProperty || unit.property_id === matchedProperty.id)
    );
    const matchedTenant =
      tenants.find((tenant) => tenant.name === item.tenant) ??
      (matchedUnit ? tenants.find((tenant) => tenant.unit_id === matchedUnit.id) : undefined);
    setForm({
      ...next,
      propertyId: matchedProperty?.id ?? "",
      unitId: matchedUnit?.id ?? "",
      tenantId: matchedTenant?.id ?? "",
    });
    setDialogMode("edit");
  }

  function closeDialog() {
    setDialogMode(null);
    setSelectedCase(null);
    setForm(emptyForm);
  }

  async function saveCase() {
    const error = validateForm(form);
    if (error) {
      setFormError(error);
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      if (dialogMode === "new") {
        const draft = caseFromForm(form, "pending");
        const id = await notionCreate("maintenance", notionFieldsFromCase(draft));
        const newCase = { ...draft, id };
        setCases((prev) => [newCase, ...prev]);
        upsertMaintenanceEntry(toMaintenanceEntry(newCase));
        applyQuickFilter(isUrgentOrOverdue(newCase) ? "overdue" : newCase.status);
        closeDialog();
      } else if (dialogMode === "edit" && selectedCase) {
        const updated = caseFromForm(form, selectedCase.id);
        if (isNotionId(selectedCase.id)) {
          await notionUpdate("maintenance", selectedCase.id, notionFieldsFromCase(updated));
        }
        setCases((prev) => prev.map((item) => (item.id === selectedCase.id ? updated : item)));
        upsertMaintenanceEntry(toMaintenanceEntry(updated));
        setSelectedCase(updated);
        setDialogMode("view");
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Couldn't save to Notion.");
    } finally {
      setSaving(false);
    }
  }

  // #9: Done is no longer instantly destructive - confirm first, capture an
  // optional completion note, and keep the original priority intact.
  async function markDone(item: MaintenanceCase) {
    const { confirmed, note } = await confirm({
      title: "Mark case as completed?",
      message: `"${item.issue}" will be moved to Completed.`,
      confirmLabel: "Mark as Done",
      withNote: true,
      noteLabel: "Completion note (optional)",
      notePlaceholder: "e.g. Replaced the tap washer, tested, all good.",
    });
    if (!confirmed) return;

    const description = note
      ? `${item.description === "No description added." ? "" : item.description}\n\n[Completed ${getTodayIso()}] ${note}`.trim()
      : item.description;
    const updated: MaintenanceCase = { ...item, status: "completed", description };

    setActionError(null);
    // #3: persist to Notion FIRST so the UI never diverges from the database.
    if (isNotionId(item.id)) {
      try {
        await notionUpdate("maintenance", item.id, {
          status: "Completed",
          description: updated.description,
        });
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Couldn't update Notion - no changes were made.");
        return;
      }
    }
    setCases((prev) => prev.map((c) => (c.id === item.id ? updated : c)));
    upsertMaintenanceEntry(toMaintenanceEntry(updated));
    if (selectedCase?.id === item.id) setSelectedCase(updated);
    applyQuickFilter("completed");
  }

  // Delete a case (used from the card menu) - archives the Notion page too.
  async function deleteCase(item: MaintenanceCase) {
    const { confirmed } = await confirm({
      title: "Delete maintenance case?",
      message: `"${item.issue}" will be removed. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!confirmed) return;
    setActionError(null);
    // #3: confirm the archive succeeded in Notion before removing it locally.
    if (isNotionId(item.id)) {
      try {
        await notionDelete("maintenance", item.id);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Couldn't delete from Notion - nothing was removed.");
        return;
      }
    }
    setCases((prev) => prev.filter((c) => c.id !== item.id));
    removeMaintenanceEntry(item.id);
    if (selectedCase?.id === item.id) closeDialog();
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 flex flex-col gap-6 sm:gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            Operations
          </p>
          <h2 className="text-2xl font-semibold mt-1 tracking-tight" style={{ color: "var(--text-primary)" }}>
            Maintenance
          </h2>
          <p className="text-sm mt-1.5" style={{ color: "var(--text-muted)" }}>
            {loading ? (
              "Loading from Notion..."
            ) : (
              <>
                {cases.length} cases
                <span style={{ color: "var(--text-faint)" }}> - </span>
                {counts.pending} pending
                <span style={{ color: "var(--text-faint)" }}> - </span>
                {counts.inProgress} in progress
              </>
            )}
          </p>
        </div>
        <button type="button" className="ui-btn ui-btn-primary" onClick={openNewCase}>
          <span className="text-base leading-none">+</span>
          <span>New Case</span>
        </button>
      </header>

      {actionError && (
        <div
          className="ui-card px-4 py-3 flex items-center justify-between gap-3"
          style={{ borderColor: "var(--danger)", background: "rgba(211,84,84,0.08)" }}
        >
          <p className="text-sm" style={{ color: "var(--danger)" }}>
            {actionError}
          </p>
          <button type="button" className="ui-btn" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <section className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <OverviewFilterButton active={activeTab === "all"} onClick={() => applyQuickFilter("all")}>
          <OverviewCard label="Total Cases" value={String(cases.length)} hint="All cases" />
        </OverviewFilterButton>
        <OverviewFilterButton active={activeTab === "pending"} onClick={() => applyQuickFilter("pending")}>
          <OverviewCard label="Pending" value={String(counts.pending)} hint="Waiting for action" />
        </OverviewFilterButton>
        <OverviewFilterButton active={activeTab === "in_progress"} onClick={() => applyQuickFilter("in_progress")}>
          <OverviewCard label="In Progress" value={String(counts.inProgress)} hint="Vendor assigned" />
        </OverviewFilterButton>
        <OverviewFilterButton active={activeTab === "completed"} onClick={() => applyQuickFilter("completed")}>
          <OverviewCard label="Completed" value={String(counts.completed)} hint="Closed cases" trend="up" />
        </OverviewFilterButton>
        <OverviewFilterButton active={activeTab === "overdue"} onClick={() => applyQuickFilter("overdue")}>
          <OverviewCard
            label="Urgent / Overdue"
            value={String(counts.urgentOverdue)}
            hint="Needs attention"
            trend="down"
          />
        </OverviewFilterButton>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                className="ui-btn shrink-0"
                onClick={() => applyQuickFilter(tab.value)}
                style={
                  active
                    ? {
                        background: "var(--accent-soft)",
                        borderColor: "var(--accent-ring)",
                        color: "var(--accent)",
                      }
                    : undefined
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[240px] max-w-xl">
            <IconSearch
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--text-faint)" }}
            />
            <input
              className="ui-input"
              placeholder="Search property, issue, tenant, vendor..."
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select
            className="w-full sm:w-auto min-w-[150px]"
            ariaLabel="Filter by status"
            value={status}
            onChange={(v) => setStatus(v as MaintenanceStatus | "all")}
            options={[
              { value: "all", label: "All statuses" },
              { value: "pending", label: "Pending" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
            ]}
          />
          <Select
            className="w-full sm:w-auto min-w-[150px]"
            ariaLabel="Filter by priority"
            value={priority}
            onChange={(v) => setPriority(v as MaintenancePriority | "all")}
            options={[
              { value: "all", label: "All priorities" },
              { value: "urgent", label: "Urgent" },
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />
          <Select
            className="w-full sm:w-auto min-w-[190px]"
            ariaLabel="Filter by property"
            value={property}
            onChange={setProperty}
            options={[
              { value: "all", label: "All properties" },
              ...propertyOptions.map((name) => ({ value: name, label: name })),
            ]}
          />
          <Select
            className="w-full sm:w-auto min-w-[150px]"
            ariaLabel="Filter by date"
            value={dateRange}
            onChange={(v) => setDateRange(v as typeof dateRange)}
            options={[
              { value: "all", label: "Any date" },
              { value: "today", label: "Reported today" },
              { value: "week", label: "Last 7 days" },
              { value: "overdue", label: "Urgent / overdue" },
            ]}
          />
          {hasFilters && (
            <button type="button" className="ui-btn" onClick={resetFilters}>
              Reset
            </button>
          )}
        </div>
      </section>

      {loading ? (
        <EmptyState pulse message="Loading maintenance cases from Notion..." />
      ) : loadError ? (
        <div className="ui-card p-12 text-center">
          <IconMaintenance className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--danger)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--danger)" }}>
            Couldn't load from Notion.
          </p>
          <p className="text-xs mt-1.5" style={{ color: "var(--text-muted)" }}>
            {loadError}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={cases.length === 0 ? "No maintenance cases in Notion yet." : "No maintenance cases match the current filters."}
        />
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((item) => (
            <MaintenanceCard
              key={item.id}
              item={item}
              onView={() => openViewCase(item)}
              onEdit={() => openEditCase(item)}
              onDone={() => markDone(item)}
            />
          ))}
        </section>
      )}

      {dialogMode && (
        <MaintenanceDialog
          key={`${dialogMode}-${selectedCase?.id ?? "new"}`}
          mode={dialogMode}
          selectedCase={selectedCase}
          form={form}
          setForm={setForm}
          properties={visibleProperties}
          units={units}
          tenants={tenants}
          saving={saving}
          formError={formError}
          onClose={closeDialog}
          onEdit={() => selectedCase && openEditCase(selectedCase)}
          onDone={() => selectedCase && markDone(selectedCase)}
          onDelete={() => selectedCase && deleteCase(selectedCase)}
          onSave={saveCase}
        />
      )}
    </div>
  );
}

function OverviewFilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-[var(--radius-lg)] transition hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2"
      style={{
        boxShadow: active ? "0 0 0 2px var(--accent-ring)" : undefined,
        // @ts-expect-error css var
        "--tw-ring-color": "var(--accent-ring)",
      }}
    >
      {children}
    </button>
  );
}

function MaintenanceCard({
  item,
  onView,
  onEdit,
  onDone,
}: {
  item: MaintenanceCase;
  onView: () => void;
  onEdit: () => void;
  onDone: () => void;
}) {
  const overdue = isOverdue(item);

  return (
    <article className="ui-card p-5 flex flex-col gap-4 min-w-0 transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
            {item.property}
          </p>
          <h3 className="text-base font-semibold mt-1 leading-snug" style={{ color: "var(--text-primary)" }}>
            {item.issue}
          </h3>
          <p className="text-xs mt-1 truncate" style={{ color: "var(--text-muted)" }}>
            {item.unit} - {item.tenant}
          </p>
        </div>
        {overdue && <span className="ui-chip ui-chip-danger shrink-0">Overdue</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="ui-chip">{item.category}</span>
        <span className={"ui-chip " + priorityChipClass(item.priority)}>
          {priorityLabels[item.priority]}
        </span>
        <span className={"ui-chip " + statusChipClass(item.status)}>
          {statusLabels[item.status]}
        </span>
      </div>

      <p className="text-sm leading-6 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
        {item.description}
      </p>

      <dl className="grid grid-cols-2 gap-3 pt-3" style={{ borderTop: "1px solid var(--border-soft)" }}>
        <Meta label="Reported" value={formatDate(item.reportedDate)} />
        <Meta label="Assigned" value={item.assignedTo} />
        <Meta label="Starts" value={formatDate(item.startDate)} />
        <Meta label="Estimate" value={`${item.durationDays} day${item.durationDays === 1 ? "" : "s"}`} />
      </dl>

      <div className="grid grid-cols-3 gap-2 mt-auto">
        <button type="button" className="ui-btn px-2" onClick={onView}>
          View
        </button>
        <button type="button" className="ui-btn px-2" onClick={onEdit}>
          Edit
        </button>
        <button
          type="button"
          className="ui-btn px-2"
          onClick={onDone}
          disabled={item.status === "completed"}
          style={{
            background: item.status === "completed" ? "var(--surface-muted)" : "var(--accent-soft)",
            borderColor: item.status === "completed" ? "var(--border-soft)" : "var(--accent-ring)",
            color: item.status === "completed" ? "var(--text-muted)" : "var(--accent)",
            cursor: item.status === "completed" ? "default" : "pointer",
          }}
        >
          Done
        </button>
      </div>
    </article>
  );
}

function MaintenanceDialog({
  mode,
  selectedCase,
  form,
  setForm,
  properties,
  units,
  tenants,
  saving,
  formError,
  onClose,
  onEdit,
  onDone,
  onDelete,
  onSave,
}: {
  mode: DialogMode;
  selectedCase: MaintenanceCase | null;
  form: MaintenanceFormState;
  setForm: React.Dispatch<React.SetStateAction<MaintenanceFormState>>;
  properties: ReturnType<typeof useRental>["visibleProperties"];
  units: ReturnType<typeof useRental>["units"];
  tenants: ReturnType<typeof useRental>["tenants"];
  saving: boolean;
  formError: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDone: () => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const [view, setView] = useState<DrawerView>("normal");
  const isReadOnly = mode === "view";
  const confirm = useConfirm();

  // #8: unsaved-change protection. Snapshot the form when the editor opens and
  // warn before discarding edits on backdrop click / Cancel / Escape.
  const [initialSnapshot] = useState(() => JSON.stringify(form));
  const dirty = !isReadOnly && JSON.stringify(form) !== initialSnapshot;

  async function attemptClose() {
    if (dirty) {
      const { confirmed } = await confirm({
        title: "Discard changes?",
        message: "This maintenance case has unsaved changes.",
        confirmLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      });
      if (!confirmed) return;
    }
    onClose();
  }
  const estimatedDue = isReadOnly && selectedCase ? selectedCase.dueDate : addDays(form.startDate, Number(form.durationDays) || 0);
  const widthClass = view === "expanded" ? "max-w-3xl" : "max-w-xl";

  const unitOptions = form.propertyId
    ? units.filter((unit) => unit.property_id === form.propertyId).sort((a, b) => a.sort_order - b.sort_order)
    : units.slice().sort((a, b) => {
        if (a.property_id !== b.property_id) return a.property_id.localeCompare(b.property_id);
        return a.sort_order - b.sort_order;
      });

  const tenantOptions = form.unitId
    ? tenants.filter((tenant) => tenant.unit_id === form.unitId)
    : tenants.slice().sort((a, b) => a.name.localeCompare(b.name));

  function selectProperty(propertyId: string) {
    const property = properties.find((item) => item.id === propertyId);
    setForm((prev) => ({
      ...prev,
      propertyId,
      property: property?.name ?? "",
      unitId: "",
      unit: "",
      tenantId: "",
      tenant: "",
    }));
  }

  function selectUnit(unitId: string) {
    const unit = units.find((item) => item.id === unitId);
    const property = unit ? properties.find((item) => item.id === unit.property_id) : undefined;
    const tenant =
      tenants.find((item) => item.unit_id === unitId) ??
      (unit?.tenant_name ? tenants.find((item) => item.name === unit.tenant_name) : undefined);
    setForm((prev) => ({
      ...prev,
      propertyId: property?.id ?? prev.propertyId,
      property: property?.name ?? prev.property,
      unitId,
      unit: unit?.name ?? "",
      tenantId: tenant?.id ?? "",
      tenant: tenant?.name ?? unit?.tenant_name ?? "",
    }));
  }

  function selectTenant(tenantId: string) {
    const tenant = tenants.find((item) => item.id === tenantId);
    const unit = tenant?.unit_id ? units.find((item) => item.id === tenant.unit_id) : undefined;
    const property = unit ? properties.find((item) => item.id === unit.property_id) : undefined;
    setForm((prev) => ({
      ...prev,
      tenantId,
      tenant: tenant?.name ?? "",
      unitId: unit?.id ?? prev.unitId,
      unit: unit?.name ?? prev.unit,
      propertyId: property?.id ?? prev.propertyId,
      property: property?.name ?? prev.property,
    }));
  }

  if (view === "minimized") {
    return (
      <div
        className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border-soft)",
          boxShadow: "0 8px 32px rgba(15,17,22,0.16)",
          maxWidth: "min(92vw, 360px)",
        }}
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
            Maintenance case
          </p>
          <p className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {mode === "new" ? "Add Case" : selectedCase?.issue ?? "Maintenance"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setView("normal")}
          className="ui-btn shrink-0"
          style={{ padding: "0.3rem 0.6rem", fontSize: "0.75rem" }}
        >
          Restore
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <button
        type="button"
        aria-label="Close maintenance drawer"
        className="absolute inset-0"
        onClick={attemptClose}
        style={{ background: "rgba(15,17,22,0.40)" }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={`relative ml-auto h-full w-full ${widthClass} flex flex-col`}
        style={{
          background: "var(--surface)",
          borderLeft: "1px solid var(--border-soft)",
          boxShadow: "-8px 0 32px rgba(15,17,22,0.10)",
        }}
      >
        <div className="px-6 py-5 border-b flex items-start justify-between gap-4" style={{ borderColor: "var(--border-soft)" }}>
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>
              Maintenance Case
            </p>
            <h3 className="text-lg font-semibold mt-1" style={{ color: "var(--text-primary)" }}>
              {mode === "new" ? "Add Case" : mode === "edit" ? "Edit Case" : selectedCase?.issue}
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Estimated completion: {formatDate(estimatedDue)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <IconBtn label="Minimize" onClick={() => setView("minimized")}>
              <MinimizeIcon />
            </IconBtn>
            <IconBtn label={view === "expanded" ? "Collapse" : "Expand"} onClick={() => setView(view === "expanded" ? "normal" : "expanded")}>
              {view === "expanded" ? <CollapseIcon /> : <ExpandIcon />}
            </IconBtn>
          </div>
        </div>

        {isReadOnly && selectedCase ? (
          <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5">
            <div className="flex flex-wrap gap-2">
              <span className="ui-chip">{selectedCase.category}</span>
              <span className={"ui-chip " + priorityChipClass(selectedCase.priority)}>
                {priorityLabels[selectedCase.priority]}
              </span>
              <span className={"ui-chip " + statusChipClass(selectedCase.status)}>
                {statusLabels[selectedCase.status]}
              </span>
              {isOverdue(selectedCase) && <span className="ui-chip ui-chip-danger">Overdue</span>}
            </div>
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Meta label="Property" value={selectedCase.property} />
              <Meta label="Unit" value={selectedCase.unit} />
              <Meta label="Tenant" value={selectedCase.tenant} />
              <Meta label="Reported" value={formatDate(selectedCase.reportedDate)} />
              <Meta label="Start" value={formatDate(selectedCase.startDate)} />
              <Meta label="Due" value={formatDate(selectedCase.dueDate)} />
              <Meta label="Duration" value={`${selectedCase.durationDays} days`} />
              <Meta label="Assigned" value={selectedCase.assignedTo} />
            </dl>
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
                Description
              </p>
              <p className="text-sm leading-6 mt-1" style={{ color: "var(--text-secondary)" }}>
                {selectedCase.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                type="button"
                className="ui-btn mr-auto"
                onClick={onDelete}
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                Delete
              </button>
              <button type="button" className="ui-btn" onClick={onEdit}>
                Edit
              </button>
              <button
                type="button"
                className="ui-btn ui-btn-primary"
                onClick={onDone}
                disabled={selectedCase.status === "completed"}
              >
                Mark as Done
              </button>
            </div>
          </div>
        ) : (
          <>
          <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Property">
                <CustomDropdown
                  value={form.propertyId}
                  placeholder="Select property..."
                  options={properties.map((property) => ({ value: property.id, label: property.name }))}
                  onChange={selectProperty}
                />
              </Field>
              <Field label="Unit">
                <CustomDropdown
                  value={form.unitId}
                  placeholder="Select unit..."
                  options={unitOptions.map((unit) => {
                    const property = properties.find((item) => item.id === unit.property_id);
                    return {
                      value: unit.id,
                      label: property ? `${property.name} - ${unit.name}` : unit.name,
                    };
                  })}
                  onChange={selectUnit}
                />
              </Field>
              <Field label="Tenant">
                <CustomDropdown
                  value={form.tenantId}
                  placeholder={form.tenant || "Select tenant..."}
                  options={tenantOptions.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
                  onChange={selectTenant}
                />
              </Field>
              <Field label="Assigned person / vendor">
                <input className="ui-input !pl-3" value={form.assignedTo} onChange={(e) => setForm((f) => ({ ...f, assignedTo: e.target.value }))} />
              </Field>
              <Field label="Issue title">
                <input className="ui-input !pl-3" value={form.issue} onChange={(e) => setForm((f) => ({ ...f, issue: e.target.value }))} />
              </Field>
              <Field label="Category">
                <CustomDropdown
                  value={form.category}
                  options={MAINTENANCE_CATEGORIES.map((c) => ({ value: c, label: c }))}
                  onChange={(value) => setForm((f) => ({ ...f, category: value }))}
                />
              </Field>
              <Field label="Priority">
                <CustomDropdown
                  value={form.priority}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                    { value: "urgent", label: "Urgent" },
                  ]}
                  onChange={(value) =>
                    setForm((f) => ({
                      ...f,
                      priority: value as MaintenancePriority,
                      manuallyUrgent: value === "urgent",
                    }))
                  }
                />
              </Field>
              <Field label="Status">
                <CustomDropdown
                  value={form.status}
                  options={[
                    { value: "pending", label: "Pending" },
                    { value: "in_progress", label: "In Progress" },
                    { value: "completed", label: "Completed" },
                  ]}
                  onChange={(value) => setForm((f) => ({ ...f, status: value as MaintenanceStatus }))}
                />
              </Field>
              <Field label="Reported date">
                <input
                  type="date"
                  className="ui-select"
                  value={form.reportedDate}
                  onChange={(e) => setForm((f) => ({ ...f, reportedDate: e.target.value }))}
                />
              </Field>
              <Field label="Start date">
                <input
                  type="date"
                  className="ui-select"
                  value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
                />
              </Field>
              <Field label="Duration days">
                <input
                  type="number"
                  min="0"
                  className="ui-select"
                  value={form.durationDays}
                  onChange={(e) => setForm((f) => ({ ...f, durationDays: e.target.value }))}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm pt-6" style={{ color: "var(--text-secondary)" }}>
                <input
                  type="checkbox"
                  checked={form.manuallyUrgent}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      manuallyUrgent: e.target.checked,
                      priority: e.target.checked ? "urgent" : f.priority === "urgent" ? "medium" : f.priority,
                    }))
                  }
                />
                Add to Urgent / Overdue manually
              </label>
            </div>

            <Field label="Short description">
              <textarea
                className="ui-input !pl-3 min-h-[96px] resize-y rounded-[10px]"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>

            <div className="ui-card p-4" style={{ background: "var(--surface-muted)" }}>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                This case starts on {formatDate(form.startDate)} and is estimated to finish by{" "}
                <span className="font-semibold" style={{ color: "var(--text-primary)" }}>
                  {formatDate(estimatedDue)}
                </span>
                . If it is not completed by then, it appears in Urgent / Overdue automatically.
              </p>
            </div>
          </div>
          <div className="px-6 py-4 border-t flex flex-col gap-3" style={{ borderColor: "var(--border-soft)" }}>
            {formError && (
              <p className="text-xs" style={{ color: "var(--danger)" }}>
                {formError}
              </p>
            )}
            <div className="flex flex-wrap gap-2 justify-end">
              <button type="button" className="ui-btn" onClick={attemptClose} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="ui-btn ui-btn-primary" onClick={onSave} disabled={saving}>
                {saving ? "Saving..." : mode === "new" ? "Add Case" : "Save Changes"}
              </button>
            </div>
          </div>
          </>
        )}
      </aside>
    </div>
  );
}

function CustomDropdown({
  value,
  options,
  onChange,
  placeholder = "Select...",
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const display = selected?.label || placeholder;

  useEffect(() => {
    if (!open) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div className="relative">
      {open && (
        <button
          type="button"
          aria-label="Close dropdown"
          className="fixed inset-0 z-[55] cursor-default"
          onClick={() => setOpen(false)}
          tabIndex={-1}
        />
      )}
      <button
        type="button"
        className="relative z-[56] w-full min-h-12 px-4 py-3 rounded-[12px] border text-left text-sm flex items-center justify-between gap-3 outline-none transition"
        onClick={() => setOpen((current) => !current)}
        style={{
          background: "var(--surface)",
          borderColor: open ? "var(--accent)" : "var(--border-soft)",
          color: selected ? "var(--text-primary)" : "var(--text-muted)",
          boxShadow: open ? "0 0 0 3px var(--accent-ring)" : undefined,
        }}
      >
        <span className="truncate">{display}</span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[70] overflow-hidden rounded-[12px] border shadow-lg"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border-soft)",
            boxShadow: "0 16px 40px rgba(0,0,0,0.22)",
          }}
        >
          <div className="max-h-56 overflow-y-auto py-1">
            {options.length === 0 ? (
              <div className="px-4 py-3 text-sm" style={{ color: "var(--text-faint)" }}>
                No options available
              </div>
            ) : (
              options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-sm transition"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={{
                      background: active ? "var(--accent-soft)" : "transparent",
                      color: active ? "var(--accent)" : "var(--text-primary)",
                    }}
                    onMouseEnter={(event) => {
                      if (!active) event.currentTarget.style.background = "var(--surface-muted)";
                    }}
                    onMouseLeave={(event) => {
                      if (!active) event.currentTarget.style.background = "transparent";
                    }}
                  >
                    {option.label}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 transition-transform"
      style={{ color: "var(--text-faint)", transform: open ? "rotate(180deg)" : "none" }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="w-8 h-8 rounded-md flex items-center justify-center"
      style={{ color: "var(--text-muted)", border: "1px solid var(--border-soft)", background: "var(--surface)" }}
    >
      {children}
    </button>
  );
}

function MinimizeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" />
    </svg>
  );
}

function EmptyState({ message, pulse = false }: { message: string; pulse?: boolean }) {
  return (
    <div className="ui-card p-12 text-center">
      <IconMaintenance
        className={"w-8 h-8 mx-auto mb-3 " + (pulse ? "animate-pulse" : "")}
        style={{ color: "var(--text-faint)" }}
      />
      <p className="text-sm" style={{ color: "var(--text-muted)" }}>
        {message}
      </p>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-faint)" }}>
        {label}
      </dt>
      <dd className="text-sm font-medium mt-0.5 truncate" style={{ color: "var(--text-primary)" }}>
        {value}
      </dd>
    </div>
  );
}
