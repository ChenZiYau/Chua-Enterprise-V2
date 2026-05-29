"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRental } from "@/context/RentalContext";
import {
  MONTHS_FULL,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABEL,
  type ExpenseCategory,
} from "@/types/rental";

const labelCls = "block text-xs font-semibold uppercase tracking-wider mb-1.5";
const labelStyle: React.CSSProperties = { color: "var(--text-muted)" };
const inputCls = "w-full px-3 py-2.5 text-sm rounded-lg border outline-none transition focus:border-[var(--accent)]";
const inputStyle: React.CSSProperties = { borderColor: "var(--border-soft)", background: "var(--surface)", color: "var(--text-primary)" };

function fmt(v: number) {
  return new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(v);
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-5 flex flex-col gap-4" style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-xs)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--text-faint)" }}>{title}</p>
      {children}
    </div>
  );
}

function ExpenseForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { visibleProperties, addExpenseEntry, getExpensesForProperty, getPropertyYTD } = useRental();
  const now = new Date();

  const [propertyId, setPropertyId] = useState(params.get("property") ?? visibleProperties[0]?.id ?? "");
  const [year, setYear] = useState(Number(params.get("year") ?? now.getFullYear()));
  const [monthIdx, setMonthIdx] = useState(params.get("month") ? Number(params.get("month")) : now.getMonth());
  const month = monthIdx + 1;
  const [expenseDate, setExpenseDate] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
  );
  const [category, setCategory] = useState<ExpenseCategory>("electricity");
  const [customCategory, setCustomCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [isIrregular, setIsIrregular] = useState(false);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => { setSaved(false); setErrors({}); }, [propertyId, year, monthIdx]);

  const amountNum = parseFloat(amount) || 0;
  const ytd = propertyId ? getPropertyYTD(propertyId, year) : { revenue: 0, expenses: 0, net: 0 };
  const existingMonthExp = propertyId
    ? getExpensesForProperty(propertyId, year).filter((e) => e.month === month).reduce((s, e) => s + e.amount, 0)
    : 0;
  const projectedExpenses = existingMonthExp + amountNum;
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  function validate() {
    const e: Record<string, string> = {};
    if (!propertyId) e.propertyId = "Select a property.";
    if (!expenseDate) e.expenseDate = "Enter the expense date.";
    if (!amount || amountNum <= 0) e.amount = "Enter an amount greater than 0.";
    if (category === "other" && !customCategory.trim()) e.customCategory = "Describe the expense category.";
    return e;
  }

  function handleSave() {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    addExpenseEntry({
      property_id: propertyId, year, month,
      expense_date: expenseDate,
      category,
      custom_category: category === "other" ? customCategory : null,
      amount: amountNum,
      description: description.trim() || null,
      is_recurring: isRecurring,
      is_irregular: isIrregular,
    });
    setSaved(true);
    setTimeout(() => router.push(propertyId ? `/admin/properties/${propertyId}` : "/admin/expenses"), 600);
  }

  return (
    <div className="px-6 lg:px-8 py-6 lg:py-8 flex flex-col gap-6 max-w-5xl">
      <Link href={propertyId ? `/admin/properties/${propertyId}` : "/admin/expenses"} className="text-xs inline-flex items-center gap-1.5 w-fit" style={{ color: "var(--text-muted)" }}>
        ← Back
      </Link>
      <div>
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: "var(--text-primary)" }}>Add Expense</h1>
        <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Record a property-level expense. Expenses are shared across all units.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
        <div className="flex flex-col gap-5">
          <SectionCard title="Property & Period">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className={labelCls} style={labelStyle}>Property</label>
                <select className="ui-select" style={errors.propertyId ? { borderColor: "var(--danger)" } : undefined} value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
                  <option value="" disabled>Select property…</option>
                  {visibleProperties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {errors.propertyId && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.propertyId}</p>}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Expense Date</label>
                <input type="date" className={inputCls} style={errors.expenseDate ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle} value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
                {errors.expenseDate && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.expenseDate}</p>}
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Month</label>
                <select className="ui-select" value={monthIdx} onChange={(e) => setMonthIdx(Number(e.target.value))}>
                  {MONTHS_FULL.map((m, i) => <option key={m} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Year</label>
                <select className="ui-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                  {years.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Expense Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls} style={labelStyle}>Category</label>
                <select className="ui-select" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)}>
                  {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>)}
                </select>
              </div>
              {category === "other" && (
                <div>
                  <label className={labelCls} style={labelStyle}>Custom Category</label>
                  <input type="text" placeholder="e.g. CCTV rental" className={inputCls} style={errors.customCategory ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
                  {errors.customCategory && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.customCategory}</p>}
                </div>
              )}
              <div>
                <label className={labelCls} style={labelStyle}>Amount (RM)</label>
                <input type="number" min={0} step="0.01" placeholder="0.00" className={inputCls} style={errors.amount ? { ...inputStyle, borderColor: "var(--danger)" } : inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} />
                {errors.amount && <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>{errors.amount}</p>}
              </div>
              <div className="md:col-span-2">
                <label className={labelCls} style={labelStyle}>Description (optional)</label>
                <input type="text" placeholder="Brief description…" className={inputCls} style={inputStyle} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls} style={labelStyle}>Notes (optional)</label>
                <textarea rows={3} placeholder="Any additional remarks…" className={`${inputCls} resize-none`} style={inputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} checked={isRecurring} onChange={(e) => { setIsRecurring(e.target.checked); if (e.target.checked) setIsIrregular(false); }} />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Recurring monthly expense</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 rounded" style={{ accentColor: "var(--accent)" }} checked={isIrregular} onChange={(e) => { setIsIrregular(e.target.checked); if (e.target.checked) setIsRecurring(false); }} />
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Irregular / one-time expense</span>
              </label>
            </div>
          </SectionCard>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-6">
          <div className="rounded-xl p-5" style={{ background: "var(--surface)", border: "1px solid var(--border-soft)", boxShadow: "var(--shadow-xs)" }}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] mb-3" style={{ color: "var(--text-faint)" }}>{MONTHS_FULL[monthIdx]} {year} Impact</p>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Revenue (YTD)</span>
                <span style={{ color: "var(--success)" }}>{fmt(ytd.revenue)}</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }}>Existing this month</span>
                <span style={{ color: "var(--danger)" }}>{fmt(existingMonthExp)}</span>
              </div>
              {amountNum > 0 && (
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--text-faint)" }}>+ This entry</span>
                  <span style={{ color: "var(--danger)" }}>+ {fmt(amountNum)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-2 mt-1" style={{ borderTop: "1px solid var(--border-soft)" }}>
                <span style={{ color: "var(--text-primary)" }}>Expenses this month</span>
                <span style={{ color: "var(--danger)" }}>{fmt(projectedExpenses)}</span>
              </div>
              <div className="flex justify-between text-xs pt-1">
                <span style={{ color: "var(--text-faint)" }}>YTD Expenses (total)</span>
                <span style={{ color: "var(--danger)" }}>{fmt(ytd.expenses + amountNum)}</span>
              </div>
            </div>
            {amountNum > 0 && (
              <div className="mt-4 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)" }}>
                <span style={{ color: "var(--text-secondary)" }}>{category === "other" && customCategory ? customCategory : EXPENSE_CATEGORY_LABEL[category]}</span>
                <span className="font-semibold ml-2" style={{ color: "var(--danger)" }}>{fmt(amountNum)}</span>
                {isRecurring && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(93,95,239,0.10)", color: "var(--accent)" }}>Recurring</span>}
                {isIrregular && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(224,162,61,0.10)", color: "var(--warning)" }}>Irregular</span>}
              </div>
            )}
            <div className="flex flex-col gap-2 mt-5">
              <button type="button" disabled={saved} onClick={handleSave} className="ui-btn ui-btn-primary w-full justify-center">
                {saved ? "Saved ✓" : "Save Expense"}
              </button>
              <Link href={propertyId ? `/admin/properties/${propertyId}` : "/admin/expenses"} className="ui-btn w-full justify-center text-center" style={{ color: "var(--text-muted)" }}>
                Cancel
              </Link>
            </div>
          </div>
          <div className="rounded-xl px-4 py-3 text-xs leading-relaxed" style={{ background: "var(--surface-muted)", border: "1px solid var(--border-soft)", color: "var(--text-faint)" }}>
            Expenses are recorded at the property level and shared across all rooms. They are not assigned to individual tenants.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewExpensePage() {
  return (
    <Suspense fallback={<div className="px-8 py-8 text-sm" style={{ color: "var(--text-muted)" }}>Loading…</div>}>
      <ExpenseForm />
    </Suspense>
  );
}
