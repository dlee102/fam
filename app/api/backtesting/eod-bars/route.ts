import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readEodhdJson } from "@/lib/eodhd-json-source";

const BASE = path.join(process.cwd(), "data/eodhd_news_windows");

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("path");
  if (!p) return NextResponse.json({ error: "path required" }, { status: 400 });

  const resolved = path.resolve(BASE, p);
  if (!resolved.startsWith(BASE)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  const relFromBase = path.relative(BASE, resolved).replace(/\\/g, "/");

  if (fs.existsSync(resolved)) {
    try {
      const raw = fs.readFileSync(resolved, "utf-8");
      const data = JSON.parse(raw);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: "parse error" }, { status: 500 });
    }
  }

  const data = await readEodhdJson<unknown>(relFromBase);
  if (data === null) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
