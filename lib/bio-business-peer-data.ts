/**
 * 기사 우측 패널용: bio_business_type_by_ticker.json 에서 동류·분포 요약.
 * + 동종 비교 투자 인사이트 (펀더멘탈 기반).
 */

import fs from "fs";
import path from "path";

import { labelForBioBusinessType } from "@/lib/bio-business-types";
import { loadFundamentalModelContextFile } from "@/lib/quant-fundamentals/load-context";
import type { FundamentalSnapshotForModel, StatementPeriodHighlight } from "@/lib/quant-fundamentals/types";
import { getKrxMarketCapMap } from "@/lib/yfinance-krx-marketcap-index";

const DATA_FILE = path.join(process.cwd(), "data", "bio_business_type_by_ticker.json");

const TYPE_ORDER = [
  "rd_pipeline",
  "platform_licensing",
  "cdmo",
  "cro",
  "dx_ivd",
  "upstream_supply",
  "unknown",
] as const;

const TYPE_SHORT: Record<string, string> = {
  rd_pipeline: "R&D",
  platform_licensing: "플랫폼",
  cdmo: "CDMO",
  cro: "CRO",
  dx_ivd: "진단·IVD",
  upstream_supply: "상류",
  unknown: "기타",
};

const TYPE_COLOR: Record<string, string> = {
  rd_pipeline: "#4f46e5",
  platform_licensing: "#7c3aed",
  cdmo: "#0284c7",
  cro: "#0d9488",
  dx_ivd: "#d97706",
  upstream_supply: "#64748b",
  unknown: "#94a3b8",
};

function normalizeTicker(code: string): string {
  const s = String(code).replace(/\D/g, "");
  if (!s) return "";
  return s.length <= 6 ? s.padStart(6, "0") : s;
}

interface JsonRow {
  business_type_id?: string;
  confidence?: number;
  name?: string;
}

function resolveTypeId(row: JsonRow | undefined): string {
  const id = row?.business_type_id;
  return id && TYPE_COLOR[id] ? id : "unknown";
}

interface CohortMember {
  code: string;
  confidence: number;
  mcap: number | null;
}

function sortCohortMembers(a: CohortMember, b: CohortMember, cohortHasAnyMcap: boolean): number {
  if (cohortHasAnyMcap) {
    const am = a.mcap;
    const bm = b.mcap;
    if (am != null && bm != null && am !== bm) return bm - am;
    if (am != null && bm == null) return -1;
    if (am == null && bm != null) return 1;
  }
  if (b.confidence !== a.confidence) return b.confidence - a.confidence;
  return a.code.localeCompare(b.code);
}

interface JsonFile {
  by_ticker?: Record<string, JsonRow>;
}

let cache: JsonFile | null | undefined;

function loadJson(): JsonFile | null {
  if (cache !== undefined) return cache;
  if (!fs.existsSync(DATA_FILE)) {
    cache = null;
    return cache;
  }
  try {
    cache = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) as JsonFile;
    return cache;
  } catch {
    cache = null;
    return cache;
  }
}

export interface BioPeerArticleRow {
  code: string;
  name: string;
  typeId: string;
  typeShort: string;
  typeLabel: string;
  color: string;
  /** 동일 business_type_id 풀에서의 순위 (1=상위) */
  cohortRank: number;
  cohortTotal: number;
  /** 시총 데이터가 풀에 하나라도 있으면 시총 우선 정렬, 아니면 분류 신뢰도 */
  rankBasis: "mcap" | "confidence";
}

export interface BioPeerDistributionSeg {
  typeId: string;
  typeShort: string;
  typeLabel: string;
  count: number;
  color: string;
}

export interface BioPeerGroupRow {
  typeId: string;
  typeShort: string;
  typeLabel: string;
  color: string;
  peers: { code: string; name: string }[];
}

export interface PeerComparisonMetric {
  label: string;
  tickerValue: string | null;
  peerMedian: string | null;
  /** short tag: e.g. "저평가", "상위 20%" */
  tag: string | null;
  tagColor: "up" | "down" | "neutral";
}

export interface BioPeerValuationInsight {
  code: string;
  name: string;
  typeShort: string;
  cohortRank: number;
  cohortTotal: number;
  comparisons: PeerComparisonMetric[];
  insightLine: string;
}

export interface ArticleBioPeerMapModel {
  rows: BioPeerArticleRow[];
  distribution: BioPeerDistributionSeg[];
  peerGroups: BioPeerGroupRow[];
  peerInsights: BioPeerValuationInsight[];
}

const MAX_PEERS_PER_TYPE = 7;

// ── Peer insight helpers ────────────────────────────────────────────────────

function numericMetric(snap: FundamentalSnapshotForModel | undefined, key: string): number | null {
  if (!snap) return null;
  const v = snap.metrics[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** Yahoo revenueGrowth 없을 때 손익 두 기간 YoY (소수, 펀더멘탈 스코어와 동일 규칙) */
function revenueGrowthFromStatements(stmt: StatementPeriodHighlight[] | undefined): number | null {
  if (!stmt?.length) return null;
  const sorted = [...stmt]
    .filter((h) => h.total_revenue !== null && h.total_revenue > 0)
    .sort((a, b) => (a.period_end < b.period_end ? 1 : -1));
  if (sorted.length < 2) return null;
  const cur = sorted[0].total_revenue!;
  const prev = sorted[1].total_revenue!;
  return (cur - prev) / prev;
}

/** operatingMargins 없을 때 최신 연·분기 영업이익 ÷ 매출 */
function operatingMarginFromStatements(stmt: StatementPeriodHighlight[] | undefined): number | null {
  if (!stmt?.length) return null;
  const sorted = [...stmt]
    .filter(
      (h) =>
        h.total_revenue !== null &&
        h.total_revenue > 0 &&
        h.operating_income !== null
    )
    .sort((a, b) => (a.period_end < b.period_end ? 1 : -1));
  if (!sorted.length) return null;
  return sorted[0].operating_income! / sorted[0].total_revenue!;
}

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentileRank(arr: number[], value: number): number {
  if (arr.length === 0) return 50;
  const below = arr.filter((v) => v < value).length;
  return Math.round((below / arr.length) * 100);
}

function fmtPer(v: number): string {
  return v >= 1000 ? `${Math.round(v).toLocaleString("ko-KR")}배` : `${v.toFixed(1)}배`;
}

function fmtPct(v: number): string {
  const pct = v * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function fmtMcapBrief(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}조`;
  if (abs >= 1e8) return `${Math.round(v / 1e8).toLocaleString("ko-KR")}억`;
  return `${Math.round(v).toLocaleString("ko-KR")}`;
}

interface CohortFundamentals {
  code: string;
  mcap: number | null;
  per: number | null;
  roe: number | null;
  revenueGrowth: number | null;
  operatingMargin: number | null;
  profitable: boolean | null;
}

function gatherCohortFundamentals(
  cohortCodes: string[],
  fundMap: Map<string, FundamentalSnapshotForModel>,
  mcapMap: Map<string, number> | null
): CohortFundamentals[] {
  return cohortCodes.map((code) => {
    const snap = fundMap.get(code);
    const stmt = snap?.statement_highlights;
    const mcap = mcapMap?.get(code) ?? numericMetric(snap, "marketCap");
    const per = numericMetric(snap, "trailingPE");
    const roe = numericMetric(snap, "returnOnEquity");
    const revenueGrowth =
      numericMetric(snap, "revenueGrowth") ?? revenueGrowthFromStatements(stmt);
    const operatingMargin =
      numericMetric(snap, "operatingMargins") ?? operatingMarginFromStatements(stmt);
    const profitable = operatingMargin !== null ? operatingMargin > 0 : null;
    return { code, mcap, per, roe, revenueGrowth, operatingMargin, profitable };
  });
}

function buildInsightForTicker(
  row: BioPeerArticleRow,
  cohortFunds: CohortFundamentals[]
): BioPeerValuationInsight | null {
  const me = cohortFunds.find((f) => f.code === row.code);
  if (!me) return null;

  const comparisons: PeerComparisonMetric[] = [];
  const tags: string[] = [];

  const allMcaps = cohortFunds.map((f) => f.mcap).filter((v): v is number => v != null);
  if (me.mcap != null && allMcaps.length >= 3) {
    const med = median(allMcaps)!;
    const pctl = percentileRank(allMcaps, me.mcap);
    const posLabel = pctl >= 80 ? "상위 " + (100 - pctl) + "%" :
                     pctl <= 20 ? "하위 " + pctl + "%" : null;
    comparisons.push({
      label: "시총",
      tickerValue: fmtMcapBrief(me.mcap),
      peerMedian: fmtMcapBrief(med),
      tag: posLabel,
      tagColor: pctl >= 50 ? "up" : "neutral",
    });
  }

  const allPer = cohortFunds.map((f) => f.per).filter((v): v is number => v != null && v > 0 && v < 300);
  if (me.per != null && me.per > 0 && me.per < 300 && allPer.length >= 3) {
    const med = median(allPer)!;
    const ratio = me.per / med;
    let tag: string | null = null;
    let tagColor: "up" | "down" | "neutral" = "neutral";
    if (ratio <= 0.65) { tag = "저평가"; tagColor = "up"; tags.push("저평가"); }
    else if (ratio >= 1.5) { tag = "고평가"; tagColor = "down"; tags.push("고평가"); }
    comparisons.push({
      label: "PER",
      tickerValue: fmtPer(me.per),
      peerMedian: fmtPer(med),
      tag,
      tagColor,
    });
  }

  const allOm = cohortFunds.map((f) => f.operatingMargin).filter((v): v is number => v != null);
  if (me.operatingMargin != null && allOm.length >= 3) {
    const med = median(allOm)!;
    const mePct = me.operatingMargin * 100;
    const medPct = med * 100;
    let tag: string | null = null;
    let tagColor: "up" | "down" | "neutral" = "neutral";
    if (me.operatingMargin > 0 && med <= 0) { tag = "흑자 우위"; tagColor = "up"; tags.push("흑자"); }
    else if (me.operatingMargin <= 0 && med > 0) { tag = "적자"; tagColor = "down"; tags.push("적자"); }
    else if (mePct > medPct + 5) { tag = "마진 우위"; tagColor = "up"; }
    else if (mePct < medPct - 5) { tag = "마진 열위"; tagColor = "down"; }
    comparisons.push({
      label: "영업이익률",
      tickerValue: `${mePct >= 0 ? "+" : ""}${mePct.toFixed(1)}%`,
      peerMedian: `${medPct >= 0 ? "+" : ""}${medPct.toFixed(1)}%`,
      tag,
      tagColor,
    });
  }

  const allRg = cohortFunds.map((f) => f.revenueGrowth).filter((v): v is number => v != null);
  if (me.revenueGrowth != null && allRg.length >= 3) {
    const med = median(allRg)!;
    let tag: string | null = null;
    let tagColor: "up" | "down" | "neutral" = "neutral";
    if (me.revenueGrowth > 0.20 && me.revenueGrowth > med * 2) {
      tag = "고성장"; tagColor = "up"; tags.push("고성장");
    } else if (me.revenueGrowth < -0.10 && me.revenueGrowth < med) {
      tag = "역성장"; tagColor = "down";
    }
    comparisons.push({
      label: "매출 성장",
      tickerValue: fmtPct(me.revenueGrowth),
      peerMedian: fmtPct(med),
      tag,
      tagColor,
    });
  }

  if (comparisons.length === 0) return null;

  const insightLine = generateInsightLine(row, me, comparisons, allPer, allOm, allRg, allMcaps);

  return {
    code: row.code,
    name: row.name,
    typeShort: row.typeShort,
    cohortRank: row.cohortRank,
    cohortTotal: row.cohortTotal,
    comparisons,
    insightLine,
  };
}

function generateInsightLine(
  row: BioPeerArticleRow,
  me: CohortFundamentals,
  comparisons: PeerComparisonMetric[],
  allPer: number[],
  allOm: number[],
  allRg: number[],
  allMcaps: number[]
): string {
  const parts: string[] = [];

  const mcapMed = allMcaps.length >= 3 ? median(allMcaps) : null;
  const perMed = allPer.length >= 3 ? median(allPer) : null;
  const omMed = allOm.length >= 3 ? median(allOm) : null;
  const rgMed = allRg.length >= 3 ? median(allRg) : null;

  if (me.per != null && me.per > 0 && me.per < 300 && perMed != null) {
    const ratio = me.per / perMed;
    if (ratio <= 0.65) {
      parts.push(`PER ${me.per.toFixed(1)}배는 동종 중간값(${perMed.toFixed(1)}배)의 ${Math.round(ratio * 100)}% — 상대 저평가 구간`);
    } else if (ratio >= 1.5) {
      parts.push(`PER ${me.per.toFixed(1)}배, 동종 중간값(${perMed.toFixed(1)}배)의 ${ratio.toFixed(1)}배 — 프리미엄 구간`);
    }
  }

  if (me.operatingMargin != null && omMed != null) {
    if (me.operatingMargin > 0 && omMed <= 0) {
      const profitCount = allOm.filter((v) => v > 0).length;
      parts.push(`동종 ${allOm.length}개 중 흑자 기업 ${profitCount}개뿐 — 수익성 희소 가치`);
    }
  }

  if (me.revenueGrowth != null && rgMed != null) {
    if (me.revenueGrowth > 0.20 && me.revenueGrowth > rgMed * 2 && rgMed > 0) {
      const multiple = (me.revenueGrowth / rgMed).toFixed(1);
      parts.push(`매출 성장 ${(me.revenueGrowth * 100).toFixed(0)}%, 동종(${(rgMed * 100).toFixed(0)}%) 대비 ${multiple}배 빠른 성장`);
    } else if (me.revenueGrowth < -0.10 && rgMed > 0) {
      parts.push(`매출 역성장(${(me.revenueGrowth * 100).toFixed(0)}%), 동종 중간값은 성장 중(${(rgMed * 100).toFixed(0)}%) — 주의 필요`);
    }
  }

  if (parts.length === 0) {
    if (me.mcap != null && mcapMed != null && allMcaps.length >= 3) {
      const pctl = percentileRank(allMcaps, me.mcap);
      if (pctl >= 75) {
        parts.push(`${row.typeShort} ${row.cohortTotal}개사 중 시총 상위 ${100 - pctl}% — 대장주급 규모`);
      } else if (pctl <= 25) {
        parts.push(`${row.typeShort} ${row.cohortTotal}개사 중 시총 하위 ${pctl}% — 소형주, 성장 여력이 핵심`);
      } else {
        parts.push(`${row.typeShort} ${row.cohortTotal}개사 중 시총 중위권 — 펀더멘탈 개선이 주가 차별화 요인`);
      }
    } else {
      parts.push(`${row.typeShort} 동종 ${row.cohortTotal}개사 중 ${row.cohortRank}위`);
    }
  }

  return parts.join(". ") + ".";
}

export function buildArticleBioPeerMapModel(
  rawTickers: readonly string[],
  tickerNames: Readonly<Record<string, string>>
): ArticleBioPeerMapModel | null {
  const data = loadJson();
  if (!data?.by_ticker) return null;

  const codes = rawTickers
    .map((t) => normalizeTicker(String(t).trim()))
    .filter((t) => t && /^\d{6}$/.test(t));
  const uniqueCodes = [...new Set(codes)];
  if (uniqueCodes.length === 0) return null;

  const articleSet = new Set(uniqueCodes);
  const byTicker = data.by_ticker;
  const mcapMap = getKrxMarketCapMap();

  const cohortMembersByType = new Map<string, CohortMember[]>();
  for (const [code, row] of Object.entries(byTicker)) {
    const t = normalizeTicker(code);
    if (!/^\d{6}$/.test(t)) continue;
    const typeId = resolveTypeId(row);
    const conf =
      typeof row.confidence === "number" && Number.isFinite(row.confidence) ? row.confidence : 0;
    const mcap = mcapMap?.get(t) ?? null;
    const m: CohortMember = { code: t, confidence: conf, mcap };
    const list = cohortMembersByType.get(typeId);
    if (list) list.push(m);
    else cohortMembersByType.set(typeId, [m]);
  }

  for (const code of uniqueCodes) {
    const row = byTicker[code];
    const typeId = resolveTypeId(row);
    let list = cohortMembersByType.get(typeId);
    if (!list) {
      list = [];
      cohortMembersByType.set(typeId, list);
    }
    if (list.some((x) => x.code === code)) continue;
    const conf =
      typeof row?.confidence === "number" && Number.isFinite(row.confidence) ? row.confidence : 0;
    list.push({ code, confidence: conf, mcap: mcapMap?.get(code) ?? null });
  }

  const cohortRankKey = new Map<string, { rank: number; total: number; basis: "mcap" | "confidence" }>();
  for (const [typeId, members] of cohortMembersByType) {
    const hasAnyMcap = members.some((x) => x.mcap != null);
    const sorted = [...members].sort((a, b) => sortCohortMembers(a, b, hasAnyMcap));
    const total = sorted.length;
    const basis: "mcap" | "confidence" = hasAnyMcap ? "mcap" : "confidence";
    sorted.forEach((mem, i) => {
      cohortRankKey.set(`${typeId}\t${mem.code}`, { rank: i + 1, total, basis });
    });
  }

  const rows: BioPeerArticleRow[] = uniqueCodes.map((code) => {
    const row = byTicker[code];
    const typeId = resolveTypeId(row);
    const typeShort = TYPE_SHORT[typeId] ?? typeId;
    const typeLabel = labelForBioBusinessType(typeId) ?? "미분류";
    const color = TYPE_COLOR[typeId] ?? TYPE_COLOR.unknown;
    const name = row?.name?.trim() || tickerNames[code] || "";
    const cr = cohortRankKey.get(`${typeId}\t${code}`) ?? {
      rank: 1,
      total: 1,
      basis: "confidence" as const,
    };
    return {
      code,
      name: name || "—",
      typeId,
      typeShort,
      typeLabel,
      color,
      cohortRank: cr.rank,
      cohortTotal: cr.total,
      rankBasis: cr.basis,
    };
  });

  const countByType = new Map<string, number>();
  for (const r of rows) {
    countByType.set(r.typeId, (countByType.get(r.typeId) ?? 0) + 1);
  }

  const distribution: BioPeerDistributionSeg[] = TYPE_ORDER.filter((id) => (countByType.get(id) ?? 0) > 0).map(
    (typeId) => ({
      typeId,
      typeShort: TYPE_SHORT[typeId] ?? typeId,
      typeLabel: labelForBioBusinessType(typeId) ?? "미분류",
      count: countByType.get(typeId) ?? 0,
      color: TYPE_COLOR[typeId] ?? TYPE_COLOR.unknown,
    })
  );

  const peersByType = new Map<string, { code: string; name: string; confidence: number }[]>();
  for (const [code, row] of Object.entries(byTicker)) {
    const t = normalizeTicker(code);
    if (!t || articleSet.has(t)) continue;
    const typeId =
      row?.business_type_id && TYPE_COLOR[row.business_type_id]
        ? row.business_type_id
        : "unknown";
    if (!countByType.has(typeId)) continue;
    const conf = typeof row.confidence === "number" && Number.isFinite(row.confidence) ? row.confidence : 0;
    const name = (typeof row.name === "string" && row.name.trim()) || tickerNames[t] || "";
    const list = peersByType.get(typeId);
    const item = { code: t, name: name || t, confidence: conf };
    if (list) list.push(item);
    else peersByType.set(typeId, [item]);
  }

  for (const [, list] of peersByType) {
    list.sort((a, b) => b.confidence - a.confidence);
  }

  const peerGroups: BioPeerGroupRow[] = distribution
    .map((d) => {
      const rawPeers = peersByType.get(d.typeId) ?? [];
      const seen = new Set<string>();
      const peers: { code: string; name: string }[] = [];
      for (const p of rawPeers) {
        if (seen.has(p.code)) continue;
        seen.add(p.code);
        peers.push({ code: p.code, name: p.name });
        if (peers.length >= MAX_PEERS_PER_TYPE) break;
      }
      return {
        typeId: d.typeId,
        typeShort: d.typeShort,
        typeLabel: d.typeLabel,
        color: d.color,
        peers,
      };
    })
    .filter((g) => g.peers.length > 0);

  // ── Peer valuation insights ──────────────────────────────────────────────
  const fundCtx = loadFundamentalModelContextFile();
  const fundMap = new Map<string, FundamentalSnapshotForModel>();
  if (fundCtx?.by_ticker) {
    for (const [code, snap] of Object.entries(fundCtx.by_ticker)) {
      const t = normalizeTicker(code);
      if (t) fundMap.set(t, snap);
    }
  }

  const peerInsights: BioPeerValuationInsight[] = [];
  for (const row of rows) {
    const cohortCodes = (cohortMembersByType.get(row.typeId) ?? []).map((m) => m.code);
    if (cohortCodes.length < 3) continue;
    const cohortFunds = gatherCohortFundamentals(cohortCodes, fundMap, mcapMap);
    const insight = buildInsightForTicker(row, cohortFunds);
    if (insight) peerInsights.push(insight);
  }

  return { rows, distribution, peerGroups, peerInsights };
}
