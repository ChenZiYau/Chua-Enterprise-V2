import { NextResponse } from "next/server";
import { getRevenue } from "@/lib/notion";
import { buildRevenueChart, type RangeType } from "@/lib/revenueChart";

const VALID_RANGES: RangeType[] = ["monthly", "3months", "6months", "12months", "custom"];

function isRangeType(v: string | null): v is RangeType {
  return !!v && (VALID_RANGES as string[]).includes(v);
}

// GET /api/revenue/chart?rangeType=6months
// GET /api/revenue/chart?rangeType=custom&startDate=2024-01-01&endDate=2026-12-31
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rangeParam = searchParams.get("rangeType");
  const rangeType: RangeType = isRangeType(rangeParam) ? rangeParam : "12months";
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  try {
    const revenue = await getRevenue();
    const result = buildRevenueChart(revenue, rangeType, startDate, endDate);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
