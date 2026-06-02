import { NextResponse } from "next/server";
import {
  getProperties,
  getUnits,
  getTenants,
  getRevenue,
  getExpenses,
} from "@/lib/notion";

const handlers = {
  properties: getProperties,
  units: getUnits,
  tenants: getTenants,
  revenue: getRevenue,
  expenses: getExpenses,
} as const;

type Entity = keyof typeof handlers;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  const { entity } = await ctx.params;
  const fn = handlers[entity as Entity];
  if (!fn) {
    return NextResponse.json({ error: "unknown entity" }, { status: 404 });
  }
  try {
    const data = await fn();
    return NextResponse.json({ data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
