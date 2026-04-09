/**
 * 기사 우측 패널용: bio_business_type_by_ticker.json 에서 동류·분포 요약.
 */

import fs from "fs";
import path from "path";

import { labelForBioBusinessType } from "@/lib/bio-business-types";

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

export interface ArticleBioPeerMapModel {
  rows: BioPeerArticleRow[];
  distribution: BioPeerDistributionSeg[];
  peerGroups: BioPeerGroupRow[];
}

const MAX_PEERS_PER_TYPE = 7;

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

  const rows: BioPeerArticleRow[] = uniqueCodes.map((code) => {
    const row = byTicker[code];
    const typeId =
      row?.business_type_id && TYPE_COLOR[row.business_type_id]
        ? row.business_type_id
        : "unknown";
    const typeShort = TYPE_SHORT[typeId] ?? typeId;
    const typeLabel = labelForBioBusinessType(typeId) ?? "미분류";
    const color = TYPE_COLOR[typeId] ?? TYPE_COLOR.unknown;
    const name = row?.name?.trim() || tickerNames[code] || "";
    return {
      code,
      name: name || "—",
      typeId,
      typeShort,
      typeLabel,
      color,
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

  return { rows, distribution, peerGroups };
}
