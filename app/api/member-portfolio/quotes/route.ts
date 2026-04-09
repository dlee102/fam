import { NextRequest, NextResponse } from "next/server";
import { MAX_MEMBER_PORTFOLIO_TICKERS } from "@/lib/firebase/member-portfolio-rtdb";
import { getLatestDailySnapshotForTicker } from "@/lib/quant-engine";

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("tickers") ?? "";
  const tickers = [
    ...new Set(
      raw
        .split(",")
        .map((t) => t.trim())
        .filter((t) => /^\d{6}$/.test(t))
    ),
  ].slice(0, MAX_MEMBER_PORTFOLIO_TICKERS);

  if (tickers.length === 0) {
    return NextResponse.json({ quotes: {} as Record<string, unknown> });
  }

  const entries = await Promise.all(
    tickers.map(async (ticker) => {
      const snap = await getLatestDailySnapshotForTicker(ticker);
      return [ticker, snap] as const;
    })
  );

  const quotes: Record<
    string,
    {
      close: number;
      prevClose: number;
      change: number;
      changePct: number;
      volume: number;
      date: string;
      prevDate: string;
    } | null
  > = {};
  for (const [t, s] of entries) quotes[t] = s;

  return NextResponse.json({ quotes });
}
