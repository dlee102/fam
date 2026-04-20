/**
 * POST /api/quant/ai-opinion
 *
 * Body: QuantOpinionRequestPayload (클라이언트가 /api/quant/insight 결과에서 추림)
 * Gemini로 2문장 한국어 코멘트. API 키 없음·호출 실패·응답 부적합 시 source=unavailable, layout 비움(대체 문구 없음).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  buildQuantOpinionLayout,
  generateQuantOpinionKo,
  isQuantOpinionPayload,
  templateQuantOpinionKo,
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

  const result = await generateQuantOpinionKo(enriched);

  // Gemini 성공 시 그대로, 실패 시 template layout을 채워서 반환
  if (result.source === "gemini" && result.layout.bullets.length > 0) {
    return NextResponse.json(result);
  }

  const tLines = templateQuantOpinionKo(enriched);
  const tLayout = buildQuantOpinionLayout(enriched, tLines, "template");
  return NextResponse.json({ lines: tLines, source: "template", layout: tLayout });
}
