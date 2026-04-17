#!/usr/bin/env python3
"""
같은 진입일·청산일에 대해 **종가 ÷ 종가**만 비교한다.

- **EODHD**: 해당일 장중 **마지막 5분봉 종가**(세션 종가) — `last_intraday_session_close`.
- **yfinance**: 같은 날짜의 **일봉 Close**(auto_adjust).

극단 10건·10건은 여전히 **전략 수익률**(예: 진입 F의 5분봉 진입·청산)으로 골라서, 그 이벤트의 날짜만 가져온 뒤 위 종가끼리 맞춘다.

  .venv/bin/python3 scripts/yfinance_horizon_check.py --entry F --hold 1 --n 10 \\
    --out-md docs/news_horizon_F_hold1_yfinance_check.md
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

try:
    import yfinance as yf
except ImportError:
    print("pip install yfinance pandas", file=sys.stderr)
    raise

from excluded_tickers import is_excluded
from entry_hold_extremes import compute_return_detail_for_event
from news_article_events import default_articles_path, iter_article_ticker_events, resolve_manifest_sources

import entry_hold_analysis as eh


def _sym(code: str) -> str:
    return str(code).strip().zfill(6)


def yf_history(code: str, start_ymd: str, end_ymd: str) -> tuple[pd.DataFrame | None, str | None]:
    """end_ymd 포함까지 가져오기 위해 end는 익일."""
    start = pd.Timestamp(start_ymd)
    end = pd.Timestamp(end_ymd) + pd.Timedelta(days=1)
    for suf in [".KS", ".KQ"]:
        sym = f"{_sym(code)}{suf}"
        t = yf.Ticker(sym)
        h = t.history(start=start, end=end, auto_adjust=True)
        if h is not None and not h.empty:
            return h, sym
    return None, None


def close_on(h: pd.DataFrame, ymd: str) -> float | None:
    if h.empty:
        return None
    idx = pd.to_datetime(h.index).tz_localize(None).normalize()
    h = h.copy()
    h.index = idx
    d = pd.Timestamp(ymd).normalize()
    if d not in h.index:
        return None
    return float(h.loc[d, "Close"])


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--entry", default="F", choices=["A", "B", "C", "D", "E", "F"])
    p.add_argument("--hold", type=int, default=1)
    p.add_argument("--n", type=int, default=10)
    p.add_argument("--out-md", type=str, default="docs/news_horizon_F_hold1_yfinance_check.md")
    args = p.parse_args()

    mbt, pak = resolve_manifest_sources(eh.EODHD_WINDOWS)
    if mbt is None and pak is None:
        print("manifest 없음", file=sys.stderr)
        sys.exit(1)

    articles_path = default_articles_path(BASE)
    raw_articles = __import__("json").loads(articles_path.read_text(encoding="utf-8"))
    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    rows: list[dict] = []
    for ev in iter_article_ticker_events(
        articles_path,
        **iter_kw,
        require_intraday=True,
        require_eod=True,
    ):
        ticker = ev["ticker"]
        if not str(ticker).isdigit() or len(str(ticker)) != 6 or is_excluded(ticker):
            continue
        d = compute_return_detail_for_event(ev, args.entry, args.hold)
        if d is None:
            continue
        ai = ev["article_idx"]
        art = raw_articles[ai] if 0 <= ai < len(raw_articles) else {}
        aid = str(art.get("article_id") or "") if isinstance(art, dict) else ""
        title = (art.get("title") or "")[:100] if isinstance(art, dict) else ""
        d["article_id"] = aid
        d["article_idx"] = ai
        d["title"] = title
        d["published_at"] = ev["published_at"]
        rows.append(d)

    seen: set[tuple[str, str]] = set()
    uniq: list[dict] = []
    for r in rows:
        aid = str(r.get("article_id") or "")
        k = (aid, r["ticker"]) if aid else (f"idx:{r.get('article_idx', '')}", r["ticker"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    rows = uniq

    rows.sort(key=lambda x: x["return"], reverse=True)
    top = rows[: args.n]
    bottom = sorted(rows, key=lambda x: x["return"])[: args.n]

    def check_one(r: dict) -> dict:
        ein = r["entry_ymd"]
        ex = r["exit_ymd"]
        h, sym = yf_history(r["ticker"], ein, ex)
        c0 = close_on(h, ein) if h is not None else None
        c1 = close_on(h, ex) if h is not None else None
        ret_yf = None
        if c0 is not None and c1 is not None and c0 > 0:
            ret_yf = (c1 / c0) - 1.0
        yf_pct = round(ret_yf * 100, 4) if ret_yf is not None else None
        r_sc = r.get("return_sess_close_pct")
        diff = None
        if yf_pct is not None and r_sc is not None:
            diff = r_sc - yf_pct
        same_sign = None
        if yf_pct is not None and r_sc is not None:
            same_sign = (r_sc >= 0) == (yf_pct >= 0)
        return {
            **r,
            "yf_symbol": sym,
            "yf_close_entry": c0,
            "yf_close_exit": c1,
            "yf_return_pct": yf_pct,
            "diff_close_pct_pts": round(diff, 4) if diff is not None else None,
            "same_sign": same_sign,
        }

    checked_top = [check_one(r) for r in top]
    checked_bot = [check_one(r) for r in bottom]

    lines = [
        f"# 종가만 비교: EODHD 세션 종가 vs yfinance 일봉 종가 (진입 {args.entry} · 보유 {args.hold}거래일, 극단 각 {args.n}건)",
        "",
        "## 전제",
        "",
        "- **표본 선정**: `전략 수익률`(ret_5m, F 진입·청산 5분봉) 기준 상·하위 — `entry_hold_extremes`와 동일.",
        "- **EODHD 종가%** (`return_sess_close_pct`): **entry_ymd**·**exit_ymd** 각각 장중 **마지막 5분봉 종가**로 `(종가_exit / 종가_entry) - 1`.",
        "- **yf 종가%**: 같은 두 날짜에 대해 yfinance **Close**(auto_adjust)만 사용.",
        "- **차이**: EODHD 종가% − yf 종가% (퍼센트포인트). 소스·조정·바 레이블 차이로 미세 오차 가능.",
        "- 한국 티커: **`.KS`** 우선, 없으면 **`.KQ`**.",
        "",
        "## 최대 수익 쪽 (상위)",
        "",
        "| EODHD 종가% | yf 종가% | 차이(pp) | 부호 일치 | yf 티커 | entry | exit | 종목 |",
        "|---:|---:|---:|:---|:---|:---|:---|:---|",
    ]

    def row_line(x: dict) -> str:
        r_sc = x.get("return_sess_close_pct")
        ry = x["yf_return_pct"]
        dff = x.get("diff_close_pct_pts")
        ss = x["same_sign"]
        sym = x["yf_symbol"] or "-"
        ss_s = "○" if ss is True else ("×" if ss is False else "-")
        t = str(x.get("ticker", ""))
        return (
            f"| {r_sc if r_sc is not None else 'N/A'} | {ry if ry is not None else 'N/A'} | "
            f"{dff if dff is not None else 'N/A'} | {ss_s} | {sym} | "
            f"{x['entry_ymd']} | {x['exit_ymd']} | {t} |"
        )

    for x in checked_top:
        lines.append(row_line(x))

    lines.extend(
        [
            "",
            "## 최악 수익 쪽 (하위)",
            "",
            "| EODHD 종가% | yf 종가% | 차이(pp) | 부호 일치 | yf 티커 | entry | exit | 종목 |",
            "|---:|---:|---:|:---|:---|:---|:---|:---|",
        ]
    )
    for x in checked_bot:
        lines.append(row_line(x))

    lines.extend(
        [
            "",
            "## 요약",
            "",
        ]
    )

    def sign_stats(xs: list[dict]) -> str:
        ok = sum(1 for x in xs if x["same_sign"] is True)
        bad = sum(1 for x in xs if x["same_sign"] is False)
        na = sum(1 for x in xs if x["same_sign"] is None)
        return f"부호 일치 {ok} / 불일치 {bad} / yf 없음 {na} (각 {len(xs)}건 중)"

    lines.append(f"- 상위: {sign_stats(checked_top)}")
    lines.append(f"- 하위: {sign_stats(checked_bot)}")
    lines.append(
        "- 이제 표는 **모두 종가÷종가**라서, **EODHD vs Yahoo**가 어긋나면 데이터 소스·상장·조정·거래일 캘린더를 의심하면 됨."
    )
    lines.append("")

    text = "\n".join(lines)
    print(text)
    outp = BASE / args.out_md.strip()
    outp.parent.mkdir(parents=True, exist_ok=True)
    outp.write_text(text, encoding="utf-8")
    print(f"\n저장: {outp}", file=sys.stderr)


if __name__ == "__main__":
    main()
