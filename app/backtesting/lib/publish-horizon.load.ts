import fs from "fs";
import path from "path";
import { unstable_noStore as noStore } from "next/cache";
import type { PublishHorizonFile } from "./publish-horizon.types";

const REL = path.join("data", "publish_horizon_curve.json");

export function loadPublishHorizon(rootDir = process.cwd()): PublishHorizonFile | null {
  noStore();
  const abs = path.join(rootDir, REL);
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, "utf-8")) as PublishHorizonFile;
  } catch {
    return null;
  }
}
