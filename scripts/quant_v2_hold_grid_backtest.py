#!/usr/bin/env python3
"""
Quant V2 표시 점수(양전 로지스틱 × (1 − 폭락위험)) × 보유 거래일 그리드 백테스트.

- 유니버스: `data/analysis/quant_v2_features.csv` 행(빌드 스크립트와 동일 필터 통과 표본).
- 수익률 (--basis 5m, 기본): `entry_hold_analysis.py`와 동일 — 진입·청산 모두 **장중 마지막 5분봉 종가**.
  - 진입 F(기본): `published_at` 이후 첫 유효 5분봉 종가.
  - 진입 A~E: 동일 스크립트 정의.
- 수익률 (--basis eod): 앵커 = i0-1 일봉 종가, 청산 = i0+h 일봉 종가(%). 학습 타겟과 동일.

점수: `quant_v2_model.json` logistic + crash_risk (웹 표시 점수와 동일 결합).

출력 (기본 5m·진입 F):
  data/analysis/quant_v2_hold_grid_backtest_all_5m_F.json (+ .md)
  data/analysis/quant_v2_hold_grid_backtest_test_5m_F.json (+ .md)

사용:
  python3 scripts/quant_v2_hold_grid_backtest.py
  python3 scripts/quant_v2_hold_grid_backtest.py --universe test --entry A
  python3 scripts/quant_v2_hold_grid_backtest.py --basis eod
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from analyze_10m_return_path import parse_publish_utc_naive  # noqa: E402
from entry_hold_analysis import (  # noqa: E402
    _cached_eod_bars,
    _cached_intra_bars,
    eod_index_for_session_ymd,
    eod_index_on_or_after,
    first_close_after_publish_on_calendar,
    first_intraday_session_open,
    last_intraday_session_close,
    t1_first_close_second_open,
    valid_ticker,
)
from excluded_tickers import is_excluded  # noqa: E402
from news_article_events import (  # noqa: E402
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)

CSV_PATH = ROOT / "data" / "analysis" / "quant_v2_features.csv"
MODEL_PATH = ROOT / "data" / "analysis" / "quant_v2_model.json"
EODHD_WINDOWS = ROOT / "data" / "eodhd_news_windows"
OUT_DIR = ROOT / "data" / "analysis"

DISPLAY_MAX = 99


def sigmoid(z: float) -> float:
    if z > 35:
        return 1.0
    if z < -35:
        return 0.0
    return 1.0 / (1.0 + math.exp(-z))


def clamp_pts(n: float) -> int:
    if not math.isfinite(n):
        return 0
    return max(0, min(DISPLAY_MAX, int(round(n))))


def logistic_prob(row: dict, block: dict, names: list[str]) -> float:
    z = float(block["intercept"])
    coefs = block["coefs"]
    mean = block["scaler_mean"]
    scale = block["scaler_scale"]
    for name in names:
        x = float(row.get(name) or 0.0)
        m = float(mean.get(name, 0.0))
        s = float(scale.get(name, 1.0)) or 1.0
        c = float(coefs.get(name, 0.0))
        z += c * ((x - m) / s)
    return sigmoid(z)


def composite_display_score(
    row: dict,
    model: dict,
) -> tuple[int, float, float]:
    """Returns (final_pts, upside_prob, crash_prob)."""
    logistic = model["logistic"]
    names = model.get("selected_features") or list(logistic["coefs"].keys())
    p_up = logistic_prob(row, logistic, names)
    upside_pts = clamp_pts(p_up * 100)
    cr = model.get("crash_risk")
    if not cr or "coefs" not in cr:
        return upside_pts, p_up, 0.0
    p_cr = logistic_prob(row, cr, names)
    crash_pts = clamp_pts(p_cr * 100)
    final = clamp_pts(round(upside_pts * (1.0 - crash_pts / 100.0)))
    return final, p_up, p_cr


def fwd_return_pct(eod: list[dict], i0: int, hold: int) -> float | None:
    if i0 < 1 or i0 + hold >= len(eod):
        return None
    anchor = eod[i0 - 1].get("close")
    if anchor is None:
        return None
    a = float(anchor)
    if a <= 0:
        return None
    c = eod[i0 + hold].get("close")
    if c is None:
        return None
    v = float(c)
    if v <= 0:
        return None
    return (v / a - 1.0) * 100.0


def hold_returns_5m_pct_grid(
    eod: list[dict],
    all_intra: list[dict],
    i0: int,
    t0_d: date,
    published_at: str | None,
    entry: str,
    h0: int,
    h1: int,
) -> dict[str, float]:
    """
    entry_hold_analysis.py 와 동일: 청산 = 해당 거래일 장중 **마지막 5분봉 종가**.
    반환: hold 일수(str) → 수익률(%).
    """
    entry = entry.upper()

    def sell_px(sell_i: int) -> float | None:
        if sell_i >= len(eod):
            return None
        sd = str(eod[sell_i].get("date", ""))[:10]
        return last_intraday_session_close(all_intra, sd)

    holds: dict[str, float] = {}
    t0_date = str(eod[i0].get("date", ""))[:10]
    t1_date = (
        str(eod[i0 + 1].get("date", ""))[:10] if i0 + 1 < len(eod) else None
    )

    px_a = last_intraday_session_close(all_intra, t0_date)
    px_b = first_intraday_session_open(all_intra, t1_date) if t1_date else None
    px_c = last_intraday_session_close(all_intra, t1_date) if t1_date else None
    px_d, px_e = (
        t1_first_close_second_open(all_intra, t1_date) if t1_date else (None, None)
    )

    px_f: float | None = None
    i_entry_f: int | None = None
    if isinstance(published_at, str) and published_at.strip():
        try:
            pu = parse_publish_utc_naive(published_at.strip())
        except (ValueError, TypeError):
            pu = None
        if pu is not None:
            got = first_close_after_publish_on_calendar(all_intra, t0_d, pu)
            if got:
                c_f, dk_f = got
                idx_f = eod_index_for_session_ymd(eod, dk_f)
                if idx_f is not None:
                    px_f = c_f
                    i_entry_f = idx_f

    for h in range(h0, h1 + 1):
        ret_frac: float | None = None
        if entry == "A" and px_a is not None and px_a > 0:
            si = i0 + h
            sp = sell_px(si)
            if sp is not None:
                ret_frac = (sp - px_a) / px_a
        elif entry == "B" and px_b and px_b > 0:
            si = i0 + 1 + h
            sp = sell_px(si)
            if sp is not None:
                ret_frac = (sp - px_b) / px_b
        elif entry == "C" and px_c and px_c > 0:
            si = i0 + 1 + h
            sp = sell_px(si)
            if sp is not None:
                ret_frac = (sp - px_c) / px_c
        elif entry == "D" and px_d and px_d > 0:
            si = i0 + 1 + h
            sp = sell_px(si)
            if sp is not None:
                ret_frac = (sp - px_d) / px_d
        elif entry == "E" and px_e and px_e > 0:
            si = i0 + 1 + h
            sp = sell_px(si)
            if sp is not None:
                ret_frac = (sp - px_e) / px_e
        elif (
            entry == "F"
            and px_f is not None
            and i_entry_f is not None
            and px_f > 0
        ):
            si = i_entry_f + h
            sp = sell_px(si)
            if sp is not None:
                ret_frac = (sp - px_f) / px_f

        if ret_frac is not None:
            holds[str(h)] = ret_frac * 100.0

    return holds


def build_paths_lookup() -> dict[tuple[int, str], tuple[str, str]]:
    """(article_idx, ticker) → (eod_path, intraday_path)."""
    mbt, pak = resolve_manifest_sources(EODHD_WINDOWS)
    if mbt is None and pak is None:
        raise SystemExit("manifest 없음 (data/eodhd_news_windows)")
    articles_path = default_articles_path(ROOT)
    if not articles_path.is_file():
        raise SystemExit(f"기사 파일 없음: {articles_path}")
    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}
    out: dict[tuple[int, str], tuple[str, str]] = {}
    for ev in iter_article_ticker_events(
        articles_path,
        **iter_kw,
        require_intraday=True,
        require_eod=True,
    ):
        m = ev["manifest_row"]
        ticker = ev["ticker"]
        eod_rel = m.get("eod_path")
        intra_rel = m.get("intraday_path")
        if not eod_rel or not intra_rel or not valid_ticker(ticker) or is_excluded(ticker):
            continue
        ai = ev["article_idx"]
        if isinstance(ai, int):
            out[(ai, ticker)] = (eod_rel, intra_rel)
    return out


def summarize_returns(vals: list[float]) -> dict:
    n = len(vals)
    wins = sum(1 for x in vals if x > 0)
    return {
        "n": n,
        "win_rate_pct": round(100.0 * wins / n, 2) if n else 0.0,
        "avg_ret_pct": round(statistics.mean(vals), 4) if n else 0.0,
        "median_ret_pct": round(statistics.median(vals), 4) if n else 0.0,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Quant V2 점수 × 홀딩 그리드 백테스트")
    ap.add_argument(
        "--universe",
        choices=("all", "test"),
        default="all",
        help="all=전체 CSV, test=시간순 뒤 30%% (train_quant_v2.py와 동일 분할)",
    )
    ap.add_argument("--hold-min", type=int, default=1)
    ap.add_argument("--hold-max", type=int, default=30)
    ap.add_argument(
        "--min-scores",
        type=str,
        default="0,50,55,60,65,70,75,80",
        help="최소 표시 점수(쉼표). 0=필터 없음",
    )
    ap.add_argument(
        "--basis",
        choices=("5m", "eod"),
        default="5m",
        help="5m=장중 5분봉 종가 진입·청산(entry_hold와 동일), eod=일봉 종가",
    )
    ap.add_argument(
        "--entry",
        choices=("A", "B", "C", "D", "E", "F"),
        default="F",
        help="진입 시점 (--basis 5m일 때만 적용). F=공개 직후 첫 5분봉 종가",
    )
    args = ap.parse_args()
    h0, h1 = args.hold_min, args.hold_max
    if h0 < 1 or h1 < h0:
        print("hold 범위 오류", file=sys.stderr)
        return 1

    if not CSV_PATH.is_file():
        print("CSV 없음:", CSV_PATH, file=sys.stderr)
        return 1
    if not MODEL_PATH.is_file():
        print("모델 없음:", MODEL_PATH, file=sys.stderr)
        return 1

    model = json.loads(MODEL_PATH.read_text(encoding="utf-8"))
    lookup = build_paths_lookup()

    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    for r in rows:
        for k in r:
            if k in ("article_id", "ticker", "t0", "published_at"):
                continue
            if r[k] == "" or r[k] is None:
                continue
            try:
                r[k] = float(r[k])
            except ValueError:
                pass

    rows.sort(key=lambda x: (x["t0"], x["ticker"], int(x.get("article_idx") or -1)))
    split_idx = int(len(rows) * 0.7)
    if args.universe == "test":
        rows = rows[split_idx:]

    min_scores = [int(x.strip()) for x in args.min_scores.split(",") if x.strip()]

    prepared: list[dict] = []
    skip = {"no_lookup": 0, "no_eod": 0, "no_intra": 0, "no_i0": 0}
    for r in rows:
        try:
            ai = int(r["article_idx"])
        except (ValueError, KeyError):
            continue
        ticker = r["ticker"]
        t0 = r["t0"]
        paths = lookup.get((ai, ticker))
        if not paths:
            skip["no_lookup"] += 1
            continue
        eod_rel, intra_rel = paths
        eod = _cached_eod_bars(eod_rel)
        if not eod:
            skip["no_eod"] += 1
            continue
        all_intra = _cached_intra_bars(intra_rel)
        if not all_intra:
            skip["no_intra"] += 1
            continue
        i0 = eod_index_on_or_after(eod, date.fromisoformat(t0))
        if i0 is None or i0 < 1:
            skip["no_i0"] += 1
            continue

        score, p_up, p_cr = composite_display_score(r, model)
        if args.basis == "eod":
            holds: dict[str, float] = {}
            for h in range(h0, h1 + 1):
                ret = fwd_return_pct(eod, i0, h)
                if ret is not None:
                    holds[str(h)] = ret
        else:
            holds = hold_returns_5m_pct_grid(
                eod,
                all_intra,
                i0,
                date.fromisoformat(t0),
                r.get("published_at"),
                args.entry,
                h0,
                h1,
            )
        prepared.append({
            "article_idx": ai,
            "ticker": ticker,
            "t0": t0,
            "score": score,
            "p_upside": round(p_up, 4),
            "p_crash": round(p_cr, 4),
            "holds": holds,
        })

    grid: dict[str, dict[str, dict[str, dict]]] = {}
    for ms in min_scores:
        key_ms = f"min_score_{ms}"
        grid[key_ms] = {}
        for h in range(h0, h1 + 1):
            hs = str(h)
            vals = [
                p["holds"][hs]
                for p in prepared
                if p["score"] >= ms and hs in p["holds"]
            ]
            grid[key_ms][hs] = summarize_returns(vals)

    # 점수 분위(5분위) × 대표 홀딩 — 스캔용
    by_score = sorted(prepared, key=lambda x: x["score"])
    n = len(by_score)
    quintile_holds = [5, 10, 20]  # 거래일
    quintile_rows = []
    if n >= 25:
        for q in range(5):
            a = q * (n // 5)
            b = (q + 1) * (n // 5) if q < 4 else n
            chunk = by_score[a:b]
            row = {"quintile": q + 1, "n": len(chunk), "score_min": chunk[0]["score"], "score_max": chunk[-1]["score"]}
            for hh in quintile_holds:
                key = str(hh)
                v = [p["holds"][key] for p in chunk if key in p["holds"]]
                row[f"hold_{hh}d"] = summarize_returns(v)
            quintile_rows.append(row)

    file_tag = "eod" if args.basis == "eod" else f"5m_{args.entry}"
    out_json = OUT_DIR / f"quant_v2_hold_grid_backtest_{args.universe}_{file_tag}.json"
    out_md = OUT_DIR / f"quant_v2_hold_grid_backtest_{args.universe}_{file_tag}.md"

    if args.basis == "eod":
        ret_def = (
            "Anchor: EOD close at i0-1. Exit: EOD close at i0+h. Percent return. "
            "(학습 타겟과 동일.)"
        )
    else:
        ret_def = (
            f"Entry {args.entry}: entry_hold_analysis.py 와 동일 (5분봉). "
            "청산: 보유 h거래일째 세션 장중 마지막 5분봉 종가. Percent return."
        )

    payload = {
        "meta": {
            "universe": args.universe,
            "basis": args.basis,
            "entry": args.entry if args.basis == "5m" else None,
            "n_csv_rows_input": len(rows),
            "n_events_with_returns": len(prepared),
            "hold_range": [h0, h1],
            "min_scores": min_scores,
            "return_definition": ret_def,
            "score_definition": "Web display: upside_pts * (1 - crash_pts/100), 0..99",
            "skip_after_filter": skip,
            "note": "전체(all) 집계는 학습에 쓰인 표본을 포함 — 엄밀 OOS는 --universe test 사용.",
        },
        "grid": grid,
        "quintiles_by_score": quintile_rows,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    def best_hold_min_n(
        key_ms: str, min_n: int
    ) -> tuple[int | None, dict | None]:
        g = grid[key_ms]
        best_h: int | None = None
        best_st: dict | None = None
        best_avg = -1e9
        for h in range(h0, h1 + 1):
            st = g.get(str(h), {})
            n_ = int(st.get("n", 0))
            if n_ < min_n:
                continue
            avg = float(st.get("avg_ret_pct", 0))
            if avg > best_avg:
                best_avg = avg
                best_h = h
                best_st = st
        return best_h, best_st

    # Markdown 요약
    basis_line = (
        f"- 가격: **5분봉** (진입 **{args.entry}**, 청산=해당일 장종 5분봉 종가)"
        if args.basis == "5m"
        else "- 가격: **일봉 종가** (학습 타겟과 동일)"
    )
    lines = [
        "# Quant V2 표시 점수 × 홀딩 그리드",
        "",
        f"- 유니버스: **{args.universe}** (이벤트 n={len(prepared)})",
        basis_line,
        f"- 홀딩: **{h0}~{h1}** 거래일",
        f"- JSON: `{out_json.relative_to(ROOT)}`",
        "",
        "## 표본 충분할 때 평균 수익 최대 홀딩 (n≥30)",
        "",
        "| min 점수 | best hold | n | 승률 | 평균% | 중앙% |",
        "|----------|-----------|---|------|-------|-------|",
    ]
    for ms in min_scores:
        key_ms = f"min_score_{ms}"
        bh, st = best_hold_min_n(key_ms, 30)
        if bh is None or st is None:
            lines.append(f"| {ms} | — | — | — | — | — |")
        else:
            lines.append(
                f"| {ms} | {bh} | {st.get('n')} | {st.get('win_rate_pct')}% | "
                f"{st.get('avg_ret_pct')} | {st.get('median_ret_pct')} |"
            )

    lines += [
        "",
        "## 전체 그리드 (min 점수 × 홀딩)",
        "",
        "| min 점수 | 홀딩 | n | 승률 | 평균 | 중앙 |",
        "|----------|------|---|------|------|------|",
    ]
    for ms in min_scores:
        key_ms = f"min_score_{ms}"
        for h in range(h0, h1 + 1):
            st = grid[key_ms].get(str(h), {})
            lines.append(
                f"| {ms} | {h} | {st.get('n', 0)} | {st.get('win_rate_pct', 0)}% | "
                f"{st.get('avg_ret_pct', 0)} | {st.get('median_ret_pct', 0)} |"
            )

    if quintile_rows:
        lines += [
            "",
            "## 점수 분위(1=최저 … 5=최고) × 홀딩",
            "",
            "| 분위 | n | 점수범위 | hold 5d 평균 | hold 10d 평균 | hold 20d 평균 |",
            "|------|---|----------|--------------|---------------|---------------|",
        ]
        for qr in quintile_rows:
            s5 = qr.get("hold_5d", {})
            s10 = qr.get("hold_10d", {})
            s20 = qr.get("hold_20d", {})
            lines.append(
                f"| Q{qr['quintile']} | {qr['n']} | {qr['score_min']}–{qr['score_max']} | "
                f"{s5.get('avg_ret_pct', '—')} | {s10.get('avg_ret_pct', '—')} | {s20.get('avg_ret_pct', '—')} |"
            )

    cmd = "python3 scripts/quant_v2_hold_grid_backtest.py"
    if args.basis != "5m" or args.entry != "F":
        cmd += f" --basis {args.basis}"
    if args.basis == "5m" and args.entry != "F":
        cmd += f" --entry {args.entry}"
    lines.append(f"\n---\n*생성: `{cmd}`*\n")
    out_md.write_text("\n".join(lines), encoding="utf-8")

    print(f"이벤트: {len(prepared)} (skip: {skip})")
    print(f"저장: {out_json}")
    print(f"저장: {out_md}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
