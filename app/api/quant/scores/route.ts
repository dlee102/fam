import { NextRequest, NextResponse } from "next/server";
import { getQuantScores } from "@/lib/quant-api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const symbol = searchParams.get("symbol");

  if (!date || !symbol) {
    return NextResponse.json(
      { error: "Missing date or symbol (query: date=YYYYMMDD&symbol=ISIN)" },
      { status: 400 }
    );
  }

  if (!/^\d{8}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYYMMDD" }, { status: 400 });
  }

  const scores = await getQuantScores(date, symbol);
  if (!scores) {
    return NextResponse.json(
      { error: "Failed to compute scores or symbol not found" },
      { status: 500 }
    );
  }

  return NextResponse.json({ date, symbol, ...scores });
}
