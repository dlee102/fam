import { NextRequest, NextResponse } from "next/server";
import { getStockChartData } from "@/lib/stock-chart-api";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const tickers = searchParams.get("tickers");

  if (!date || !tickers) {
    return NextResponse.json(
      { error: "Missing date or tickers (query: date=YYYYMMDD&tickers=005930,003090)" },
      { status: 400 }
    );
  }

  if (!/^\d{8}$/.test(date)) {
    return NextResponse.json({ error: "date must be YYYYMMDD" }, { status: 400 });
  }

  const tickerList = tickers.split(",").map((t) => t.trim()).filter(Boolean);
  const data = await getStockChartData(date, tickerList);

  if (!data) {
    return NextResponse.json(
      { error: "Failed to load chart data" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}
