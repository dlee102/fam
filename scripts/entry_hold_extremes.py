#!/usr/bin/env python3
"""
진입(F 등)·보유 거래일 1건당 수익률 분포에서 상위/하위 N건 추출.

  python3 scripts/entry_hold_extremes.py --entry F --hold 1 --n 10
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))

import entry_hold_analysis as eh
from excluded_tickers import is_excluded
from news_article_events import default_articles_path, iter_article_ticker_events, resolve_manifest_sources
from analyze_10m_return_path import parse_publish_utc_naive


def valid_ticker(t: str) -> bool:
    return bool(t and len(t) == 6 and t.isdigit())


def compute_return_detail_for_event(
    ev: dict,
    entry: str,
    hold: int,
) -> dict | None:
    """
    (entry, hold) 수익률 + EOD 바 기준 진입/청산 **거래일**(YYYY-MM-DD) + 5분봉 가격.
    yfinance 일봉과 대조할 때 날짜 기준으로 사용.
    """
    m = ev["manifest_row"]
    ticker = ev["ticker"]
    t0_str = ev["t0"]
    rel = m.get("intraday_path")
    eod_rel = m.get("eod_path")
    if not rel or not eod_rel:
        return None

    bars = eh._cached_eod_bars(eod_rel)
    all_intra = eh._cached_intra_bars(rel)
    t0_d = date.fromisoformat(t0_str)
    i0 = eh.eod_index_on_or_after(bars, t0_d)
    if i0 is None:
        return None

    t0_date = bars[i0]["date"]
    t1_date = bars[i0 + 1]["date"] if i0 + 1 < len(bars) else None

    px_a = eh.last_intraday_session_close(all_intra, t0_date)
    px_b = (
        eh.first_intraday_session_open(all_intra, t1_date)
        if t1_date
        else None
    )
    px_c = (
        eh.last_intraday_session_close(all_intra, t1_date)
        if t1_date
        else None
    )
    px_d, px_e = (
        eh.t1_first_close_second_open(all_intra, t1_date)
        if t1_date
        else (None, None)
    )

    px_f = None
    i_entry_f = None
    pa = ev.get("published_at")
    if isinstance(pa, str) and pa.strip():
        try:
            pu = parse_publish_utc_naive(pa.strip())
        except (ValueError, TypeError):
            pu = None
        if pu is not None:
            got = eh.first_close_after_publish_on_calendar(all_intra, t0_d, pu)
            if got:
                c_f, dk_f = got
                idx_f = eh.eod_index_for_session_ymd(bars, dk_f)
                if idx_f is not None:
                    px_f = c_f
                    i_entry_f = idx_f

    def sell_px(sell_i: int) -> float | None:
        if sell_i >= len(bars):
            return None
        sd = bars[sell_i]["date"]
        return eh.last_intraday_session_close(all_intra, sd)

    def ymd(bar_date) -> str:
        return str(bar_date)[:10]

    def add_session_close_fields(out: dict, ein: str, ex: str) -> dict:
        """진입일·청산일 각각의 장 종가(당일 마지막 5분봉 종가) 및 종가→종가 수익률(%)."""
        p0 = eh.last_intraday_session_close(all_intra, ein)
        p1 = eh.last_intraday_session_close(all_intra, ex)
        out["px_entry_sess_close"] = p0
        out["px_exit_sess_close"] = p1
        if p0 is not None and p1 is not None and p0 > 0:
            rsc = (p1 - p0) / p0
            out["return_sess_close_pct"] = round(rsc * 100, 4)
        else:
            out["return_sess_close_pct"] = None
        return out

    if entry == "A":
        if px_a is None:
            return None
        si = i0 + hold
        sp = sell_px(si)
        if sp is None or px_a <= 0:
            return None
        r = (sp - px_a) / px_a
        ein, ex = ymd(t0_date), ymd(bars[si]["date"])
        return add_session_close_fields(
            {
                "ticker": ticker,
                "return": r,
                "return_pct": round(r * 100, 4),
                "entry_ymd": ein,
                "exit_ymd": ex,
                "px_in_5m": px_a,
                "px_out_5m": sp,
            },
            ein,
            ex,
        )

    if entry in ("B", "C", "D", "E"):
        tag_px = {"B": px_b, "C": px_c, "D": px_d, "E": px_e}[entry]
        if tag_px is None or tag_px <= 0 or t1_date is None:
            return None
        if i0 + 1 + hold >= len(bars):
            return None
        si = i0 + 1 + hold
        sp = sell_px(si)
        if sp is None:
            return None
        r = (sp - tag_px) / tag_px
        ein, ex = ymd(t1_date), ymd(bars[si]["date"])
        return add_session_close_fields(
            {
                "ticker": ticker,
                "return": r,
                "return_pct": round(r * 100, 4),
                "entry_ymd": ein,
                "exit_ymd": ex,
                "px_in_5m": tag_px,
                "px_out_5m": sp,
            },
            ein,
            ex,
        )

    if entry == "F":
        if px_f is None or i_entry_f is None or px_f <= 0:
            return None
        si = i_entry_f + hold
        sp = sell_px(si)
        if sp is None:
            return None
        r = (sp - px_f) / px_f
        ein, ex = ymd(bars[i_entry_f]["date"]), ymd(bars[si]["date"])
        return add_session_close_fields(
            {
                "ticker": ticker,
                "return": r,
                "return_pct": round(r * 100, 4),
                "entry_ymd": ein,
                "exit_ymd": ex,
                "px_in_5m": px_f,
                "px_out_5m": sp,
            },
            ein,
            ex,
        )

    return None


def compute_return_for_event(
    ev: dict,
    entry: str,
    hold: int,
) -> float | None:
    """단일 이벤트에 대해 (entry, hold) 수익률(소수). 불가면 None."""
    d = compute_return_detail_for_event(ev, entry, hold)
    return d["return"] if d else None


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--entry", default="F", choices=["A", "B", "C", "D", "E", "F"])
    p.add_argument("--hold", type=int, default=1, help="보유 거래일 (1~30)")
    p.add_argument("--n", type=int, default=10, help="상·하위 각 N건")
    p.add_argument(
        "--out-md",
        type=str,
        default="",
        help="지정 시 해당 경로에 Markdown 저장 (프로젝트 루트 기준)",
    )
    args = p.parse_args()

    mbt, pak = resolve_manifest_sources(eh.EODHD_WINDOWS)
    if mbt is None and pak is None:
        print("manifest 없음", file=sys.stderr)
        sys.exit(1)

    articles_path = default_articles_path(BASE)
    raw_articles = json.loads(articles_path.read_text(encoding="utf-8"))
    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    rows: list[dict] = []
    for ev in iter_article_ticker_events(
        articles_path,
        **iter_kw,
        require_intraday=True,
        require_eod=True,
    ):
        ticker = ev["ticker"]
        if not valid_ticker(ticker) or is_excluded(ticker):
            continue
        r = compute_return_for_event(ev, args.entry, args.hold)
        if r is None:
            continue
        ai = ev["article_idx"]
        art = raw_articles[ai] if 0 <= ai < len(raw_articles) else {}
        title = art.get("title") if isinstance(art, dict) else ""
        aid = art.get("article_id") if isinstance(art, dict) else ""
        rows.append({
            "article_idx": ai,
            "article_id": aid or "",
            "title": (title or "")[:120],
            "ticker": ticker,
            "t0": ev["t0"],
            "published_at": ev["published_at"],
            "return": r,
            "return_pct": round(r * 100, 4),
        })

    if not rows:
        print("표본 없음")
        sys.exit(1)

    # 중복 제거: 같은 article_id·티커가 JSON에 여러 행으로 반복되는 경우가 있음
    seen: set[tuple[str, str]] = set()
    uniq: list[dict] = []
    for r in rows:
        aid = str(r.get("article_id") or "")
        k = (aid, r["ticker"]) if aid else (f"idx:{r['article_idx']}", r["ticker"])
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    rows = uniq

    rows.sort(key=lambda x: x["return"], reverse=True)
    top = rows[: args.n]
    bottom = sorted(rows, key=lambda x: x["return"])[: args.n]

    labels = {
        "A": "T=0 장종 5분봉 종가",
        "B": "T+1 첫 5분봉 시가",
        "C": "T+1 장종 5분봉 종가",
        "D": "T+1 첫 5분봉 종가",
        "E": "T+1 두 번째 5분봉 시가",
        "F": "공개 시각 직후 첫 장중 5분봉 종가",
    }

    lines = [
        f"# 진입 {args.entry} · 보유 {args.hold}거래일 — 수익률 극단 {args.n}건",
        "",
        f"- **진입 정의**: {labels[args.entry]}",
        f"- **보유**: 진입 거래일(A·F) 또는 T+1(B~E) 기준 **+{args.hold}거래일** 장종 5분봉 청산",
        f"- **표본 수 (유효)**: {len(rows)}",
        "",
        "## 최대 수익률 (상위)",
        "",
        "| 순위 | 수익률(%) | 티커 | t0 | published_at | article_id | 제목(앞 120자) |",
        "|:---:|:---:|:---:|:---|:---|:---|:---|",
    ]
    for i, x in enumerate(top, 1):
        t = str(x["title"]).replace("|", " ")
        lines.append(
            f"| {i} | {x['return_pct']} | {x['ticker']} | {x['t0']} | {x['published_at']} | {x['article_id']} | {t} |"
        )

    lines.extend([
        "",
        "## 최악 수익률 (하위)",
        "",
        "| 순위 | 수익률(%) | 티커 | t0 | published_at | article_id | 제목(앞 120자) |",
        "|:---:|:---:|:---:|:---|:---|:---|:---|",
    ])
    for i, x in enumerate(bottom, 1):
        t = str(x["title"]).replace("|", " ")
        lines.append(
            f"| {i} | {x['return_pct']} | {x['ticker']} | {x['t0']} | {x['published_at']} | {x['article_id']} | {t} |"
        )

    text = "\n".join(lines) + "\n"
    print(text)
    out = args.out_md.strip()
    if out:
        outp = BASE / out
        outp.parent.mkdir(parents=True, exist_ok=True)
        outp.write_text(text, encoding="utf-8")
        print(f"\n저장: {outp}", file=sys.stderr)


if __name__ == "__main__":
    main()
