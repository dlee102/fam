import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const BASE = path.join(process.cwd(), "data/eodhd_news_windows");

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams.get("path");
  if (!p) return NextResponse.json({ error: "path required" }, { status: 400 });

  // prevent directory traversal
  const resolved = path.resolve(BASE, p);
  if (!resolved.startsWith(BASE)) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  if (!fs.existsSync(resolved)) {
    return NextResponse.json({ error: "file not found" }, { status: 404 });
  }

  try {
    const raw = fs.readFileSync(resolved, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "parse error" }, { status: 500 });
  }
}
