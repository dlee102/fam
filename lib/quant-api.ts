/**
 * Call Python quant module and parse JSON output.
 */

import { spawn } from "child_process";
import path from "path";

export interface QuantScores {
  foreign_flow: number | null;
  volume: number | null;
  orderbook_imbalance: number | null;
  momentum: number | null;
  trend: number | null;
  spread: number | null;
  foreign_net_millions: number | null;
}

export async function getQuantScores(
  date: string,
  symbol: string
): Promise<QuantScores | null> {
  const projectRoot = path.resolve(process.cwd());
  const quantRun = path.join(projectRoot, "quant", "run.py");

  return new Promise((resolve) => {
    const proc = spawn("python3", ["-m", "quant.run", date, "--symbol", symbol], {
      cwd: projectRoot,
      env: { ...process.env, PYTHONPATH: projectRoot },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        console.error("[quant-api] stderr:", stderr);
        resolve(null);
        return;
      }
      try {
        const data = JSON.parse(stdout.trim());
        resolve({
          foreign_flow: data.scores?.foreign_flow ?? null,
          volume: data.scores?.volume ?? null,
          orderbook_imbalance: data.scores?.orderbook_imbalance ?? null,
          momentum: data.scores?.momentum ?? null,
          trend: data.scores?.trend ?? null,
          spread: data.scores?.spread ?? null,
          foreign_net_millions: data.foreign_net_millions ?? null,
        });
      } catch {
        resolve(null);
      }
    });
  });
}
