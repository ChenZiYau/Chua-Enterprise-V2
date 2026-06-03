import { NextResponse } from "next/server";
import {
  getProperties,
  getUnits,
  getTenants,
  getRevenue,
  getExpenses,
  getMaintenance,
  createEntity,
  updateEntity,
  deleteEntity,
  type Entity,
} from "@/lib/notion";

const handlers = {
  properties: getProperties,
  units: getUnits,
  tenants: getTenants,
  revenue: getRevenue,
  expenses: getExpenses,
  maintenance: getMaintenance,
} as const;

// Entities that currently support writing back to Notion.
const WRITABLE: Entity[] = ["properties", "units", "maintenance", "revenue", "expenses", "tenants"];

function isWritable(entity: string): entity is Entity {
  return (WRITABLE as string[]).includes(entity);
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  const { entity } = await ctx.params;
  const fn = handlers[entity as keyof typeof handlers];
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

export async function POST(
  req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  const { entity } = await ctx.params;
  if (!isWritable(entity)) {
    return NextResponse.json({ error: "entity is not writable" }, { status: 400 });
  }
  try {
    const fields = (await req.json()) as Record<string, unknown>;
    const id = await createEntity(entity, fields);
    return NextResponse.json({ id });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  const { entity } = await ctx.params;
  if (!isWritable(entity)) {
    return NextResponse.json({ error: "entity is not writable" }, { status: 400 });
  }
  try {
    const body = (await req.json()) as { id?: string; fields?: Record<string, unknown> };
    if (!body.id) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }
    await updateEntity(entity, body.id, body.fields ?? {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ entity: string }> }
) {
  const { entity } = await ctx.params;
  if (!isWritable(entity)) {
    return NextResponse.json({ error: "entity is not writable" }, { status: 400 });
  }
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "missing id" }, { status: 400 });
    }
    await deleteEntity(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
