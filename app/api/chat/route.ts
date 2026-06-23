import { NextResponse } from "next/server";
import {
  getProperties,
  getUnits,
  getRevenue,
  getExpenses,
  getTenants,
  getMaintenance,
} from "@/lib/db";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

function myr(n: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    maximumFractionDigits: 0,
  }).format(n);
}

// Build a compact, factual snapshot of the portfolio for the model to ground
// its answers in. Kept small so it stays within the prompt budget.
async function buildContext(): Promise<string> {
  const [properties, units, revenue, expenses, tenants, maintenance] = await Promise.all([
    getProperties(),
    getUnits(),
    getRevenue(),
    getExpenses(),
    getTenants(),
    getMaintenance(),
  ]);

  const totalRevenue = revenue.reduce((s, r) => s + r.totalAmount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const rented = units.filter((u) => u.isRented).length;
  const vacant = units.filter((u) => !u.isRented);
  const outstanding = revenue.filter((r) => r.paymentStatus && r.paymentStatus !== "paid");
  const openMaint = maintenance.filter((m) => (m.status || "").toLowerCase() !== "completed");

  const propLines = properties
    .map((p) => {
      const pu = units.filter((u) => u.property === p.name);
      const r = revenue.filter((x) => x.property === p.name).reduce((s, x) => s + x.totalAmount, 0);
      return `- ${p.name} (${p.city || "?"}): ${pu.filter((u) => u.isRented).length}/${pu.length} units rented, revenue ${myr(r)}`;
    })
    .join("\n");

  return [
    `PORTFOLIO SNAPSHOT (live from the database):`,
    `Properties: ${properties.length}. Units: ${units.length} (${rented} rented, ${vacant.length} vacant). Tenants: ${tenants.length}.`,
    `Total revenue recorded: ${myr(totalRevenue)}. Total expenses: ${myr(totalExpenses)}. Net: ${myr(totalRevenue - totalExpenses)}.`,
    `Outstanding payments: ${outstanding.length} entries totalling ${myr(outstanding.reduce((s, r) => s + r.totalAmount, 0))}.`,
    `Open maintenance cases: ${openMaint.length}.`,
    ``,
    `PROPERTIES:`,
    propLines || "(none)",
    ``,
    vacant.length
      ? `VACANT UNITS: ${vacant.map((u) => `${u.property} · ${u.name}`).join("; ")}`
      : `VACANT UNITS: none`,
  ].join("\n");
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Assistant is not configured (GROQ_API_KEY missing)." },
      { status: 503 }
    );
  }

  let body: { messages?: ChatMessage[] };
  try {
    body = (await req.json()) as { messages?: ChatMessage[] };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const history = (body.messages ?? []).filter((m) => m.role === "user" || m.role === "assistant").slice(-10);
  if (history.length === 0) {
    return NextResponse.json({ error: "No message provided." }, { status: 400 });
  }

  let context = "";
  try {
    context = await buildContext();
  } catch {
    context = "Portfolio data is temporarily unavailable.";
  }

  const system: ChatMessage = {
    role: "system",
    content:
      "You are the assistant for Chua Enterprise, a Malaysian property rental management app. " +
      "Answer questions about properties, rooms/units, tenants, revenue, expenses, invoices and maintenance " +
      "using ONLY the snapshot below. Be concise and practical, use MYR (RM) for money, and if the snapshot " +
      "doesn't contain the answer, say so plainly.\n\n" +
      context,
  };

  try {
    const res = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.3,
        max_tokens: 600,
        messages: [system, ...history],
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Assistant error (${res.status}): ${text.slice(0, 200)}` }, { status: 502 });
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = data.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a response.";
    return NextResponse.json({ reply });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
