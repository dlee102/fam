/**
 * POST /api/quant/ai-opinion
 *
 * Body: QuantOpinionRequestPayload (클라이언트가 /api/quant/insight 결과에서 추림)
 * Gemini로 2문장 한국어 코멘트. API 키 없거나 실패 시 규칙 기반 템플릿.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateQuantOpinionKo,
  isQuantOpinionPayload,
} from "@/lib/quant-ai-opinion";
import { getFundamentalSnapshotForTicker } from "@/lib/quant-fundamentals";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isQuantOpinionPayload(body)) {
    return NextResponse.json(
      { error: "Invalid quant opinion payload" },
      { status: 400 }
    );
  }

  const snapshot = getFundamentalSnapshotForTicker(body.ticker);
  const enriched = {
    ...body,
    fundamentals_snapshot: snapshot ?? null,
  };

  const { lines, source, layout } = await generateQuantOpinionKo(enriched);
  return NextResponse.json({ lines, source, layout });
}
