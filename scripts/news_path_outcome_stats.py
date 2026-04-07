#!/usr/bin/env python3
"""
뉴스 이벤트 후 10거래일 10분봉 경로가 **막 봉 기준 양수(+) vs 음수(-)** 로 갈릴 때,
EODHD 일봉·5분봉만으로 **기술적·거래량 성격이 어떻게 다른지** 기본 통계만 냅니다.

- 분모·경로 정의는 `analyze_10m_return_path.py` 와 동일 (`extract_series` 결과의 마지막 봉 누적 수익률).
- 표본: `somedaynews_article_tickers.json` + manifest (intraday+EOD OK).
- 0% 종료 행은 양/음 비교에서 제외(건수만 기록).

출력:
  - stdout: 요약 표
  - data/analysis/news_path_outcome_stats.json
  - 웹: `cp data/analysis/news_path_outcome_stats.json public/data/analysis/` 후 /backtesting 에 표시

  python3 scripts/news_path_outcome_stats.py
  python3 scripts/news_path_outcome_stats.py --no-json   # 콘솔만
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path
from statistics import mean, median, pstdev

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import analyze_10m_return_path as a
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)

SAVE_DIR = ROOT / "data" / "analysis"
SAVE_DIR.mkdir(parents=True, exist_ok=True)
OUT_JSON = SAVE_DIR / "news_path_outcome_stats.json"

try:
    from scipy.stats import mannwhitneyu

    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False


def kst_hour(published_at: str) -> int | None:
    try:
        dt = a.parse_publish_utc_naive(published_at.strip())
        kst = dt.replace(tzinfo=timezone.utc).astimezone(a.KST)
        return kst.hour
    except Exception:
        return None


def eod_feature_block(eod_bars: list, t0: date) -> dict:
    """일봉 기반 선행 수익·이벤트일 수익·MA 이격(기사 공개 전일 종가 기준)."""
    dates = [b["date"] for b in eod_bars]
    ei = next((i for i, d in enumerate(dates) if date.fromisoformat(d) >= t0), None)
    out: dict = {
        "event_day_ret": None,
        "ret_1d_pre": None,
        "ret_5d_pre": None,
        "ret_10d_pre": None,
        "vol_ratio_eod": None,
        "close_vs_ma5_pre": None,
        "close_vs_ma20_pre": None,
    }
    if ei is None or ei < 6:
        return out

    def cl(i: int) -> float | None:
        if 0 <= i < len(eod_bars):
            v = eod_bars[i].get("close")
            return float(v) if v is not None else None
        return None

    c_m1 = cl(ei - 1)
    c0 = cl(ei)
    if c_m1 and c0 and c_m1 > 0:
        out["event_day_ret"] = c0 / c_m1 - 1.0

    c_m2 = cl(ei - 2)
    if c_m2 and c_m1 and c_m2 > 0:
        out["ret_1d_pre"] = c_m1 / c_m2 - 1.0

    c_m6 = cl(ei - 6)
    if c_m6 and c_m1 and c_m6 > 0:
        out["ret_5d_pre"] = c_m1 / c_m6 - 1.0

    if ei >= 11:
        c_m11 = cl(ei - 11)
        if c_m11 and c_m1 and c_m11 > 0:
            out["ret_10d_pre"] = c_m1 / c_m11 - 1.0

    if ei >= 5:
        slice5 = [cl(ei - 5 + k) for k in range(5)]
        if all(x is not None and x > 0 for x in slice5):
            ma5 = sum(slice5) / 5.0
            out["close_vs_ma5_pre"] = c_m1 / ma5 - 1.0 if c_m1 else None

    if ei >= 20:
        slice20 = [cl(ei - 20 + k) for k in range(20)]
        if all(x is not None and x > 0 for x in slice20):
            ma20 = sum(slice20) / 20.0
            out["close_vs_ma20_pre"] = c_m1 / ma20 - 1.0 if c_m1 else None

    ev_vol = eod_bars[ei].get("volume", 0) or 0
    pre_vols = [b.get("volume", 0) or 0 for b in eod_bars[max(0, ei - 20) : ei]]
    avg_vol = sum(pre_vols) / len(pre_vols) if pre_vols else 0
    if avg_vol > 0 and ev_vol:
        out["vol_ratio_eod"] = float(ev_vol) / float(avg_vol)

    return out


def num_stats(values: list[float | None]) -> dict:
    v = [x for x in values if x is not None and isinstance(x, (int, float)) and not math.isnan(x)]
    if not v:
        return {"n": 0, "mean": None, "median": None, "stdev": None}
    return {
        "n": len(v),
        "mean": mean(v),
        "median": median(v),
        "stdev": pstdev(v) if len(v) > 1 else 0.0,
    }


def mw_p(pos: list, neg: list) -> float | None:
    vp = [x for x in pos if x is not None and isinstance(x, (int, float))]
    vn = [x for x in neg if x is not None and isinstance(x, (int, float))]
    if not HAS_SCIPY or len(vp) < 8 or len(vn) < 8:
        return None
    _, p = mannwhitneyu(vp, vn, alternative="two-sided")
    return float(p)


def main() -> None:
    parser = argparse.ArgumentParser(description="뉴스 경로 양·음 종료 기본 통계")
    parser.add_argument("--no-json", action="store_true", help="JSON 저장 안 함")
    args = parser.parse_args()

    articles_path = default_articles_path(ROOT)
    if not articles_path.is_file():
        raise SystemExit(f"기사 파일 없음: {articles_path}")

    mbt, pak = resolve_manifest_sources(a.OUT_DIR)
    if mbt is None and pak is None:
        raise SystemExit("manifest 없음 (per_article 또는 루트 manifest.json)")
    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    pos_rows: list[dict] = []
    neg_rows: list[dict] = []
    zero_n = 0

    for ev in iter_article_ticker_events(
        articles_path, **iter_kw, require_intraday=True, require_eod=True
    ):
        m = ev["manifest_row"]
        pack = a.extract_series_with_intraday(
            m["intraday_path"], ev["t0"], ev["published_at"]
        )
        if pack is None:
            continue
        series, intra = pack
        r_end = series[a.TOTAL_BARS - 1]

        t0 = date.fromisoformat(ev["t0"])
        eod = eod_feature_block(a.load_eod_bars(m["eod_path"]), t0)

        row = {
            "final_ret": r_end,
            "pub_hour_kst": kst_hour(ev["published_at"]),
            **intra,
            **eod,
        }

        if r_end > 0:
            pos_rows.append(row)
        elif r_end < 0:
            neg_rows.append(row)
        else:
            zero_n += 1

    keys = [
        "vol_ratio_eod",
        "event_day_ret",
        "ret_1d_pre",
        "ret_5d_pre",
        "ret_10d_pre",
        "close_vs_ma5_pre",
        "close_vs_ma20_pre",
        "overnight_gap",
        "open_to_anchor_pct",
        "pre_publish_range_pct",
        "final_ret",
    ]

    feature_tables: dict = {}
    for k in keys:
        pv = [r.get(k) for r in pos_rows]
        nv = [r.get(k) for r in neg_rows]
        feature_tables[k] = {
            "positive": num_stats(pv),
            "negative": num_stats(nv),
            "mann_whitney_p": mw_p(pv, nv),
        }

    # 기사 공개 시각(간이): 장 후(16시 이상) 비율
    def after_close_share(rows: list[dict]) -> float | None:
        hs = [r["pub_hour_kst"] for r in rows if r.get("pub_hour_kst") is not None]
        if not hs:
            return None
        return sum(1 for h in hs if h >= 16) / len(hs)

    n_pos, n_neg = len(pos_rows), len(neg_rows)

    interpretation = [
        "막 봉 누적수익률 >0 인 그룹과 <0 인 그룹의 변수별 평균·중앙값을 비교한 것입니다.",
        "⚠ event_day_ret 는 '이벤트 첫 거래일' 일봉 종가/전일종가입니다. 이 종가는 10일 경로(D0~D9)의 D0 종가와 같은 날이므로 "
        "경로 결과(막 봉 방향)와 직접 겹칩니다. 따라서 이 변수의 p값(예: <0.0001)은 사후 군집 설명에 가깝고, "
        "독립적인 선행 예측 신호로 해석하면 안 됩니다.",
        "open_to_anchor_pct 는 당일 시가 대비 기사 공개 직후 기준가(첫 유효 5분봉 종가)까지 변화율(%)입니다.",
        "close_vs_ma5_pre / close_vs_ma20_pre 는 이벤트일 직전 거래일 종가가 각 이동평균 대비 얼마나 위에 있었는지(비율-1)입니다.",
        "vol_ratio_eod 는 이벤트일 일봉 거래량 / 직전 20거래일 평균 거래량입니다. 중앙값 기준으로는 두 그룹 모두 1× 미만이며, "
        "평균이 높아 보이는 것은 극단치 때문입니다. '시끄러운 날' 해석 시 mean이 아닌 median을 참고하세요.",
        "다중검정 주의: 11개 변수에 대해 보정 없이 MWU를 수행했습니다. Bonferroni 기준 유의 임계값은 0.05/11 ≈ 0.0045입니다. "
        "p < 0.0045 를 충족하지 못하는 변수는 통계적으로 유의하다고 단정하기 어렵습니다.",
    ]

    N_TESTS = len(keys)
    BONFERRONI_THRESHOLD = 0.05 / N_TESTS

    out = {
        "source": {
            "articles": str(articles_path),
            "manifest": str(a.OUT_DIR / "manifest.json"),
            "path_definition": "analyze_10m_return_path.extract_series, 마지막 10분봉 누적 수익률",
        },
        "multiple_testing": {
            "n_tests": N_TESTS,
            "alpha": 0.05,
            "bonferroni_threshold": BONFERRONI_THRESHOLD,
            "note": f"MWU를 {N_TESTS}개 변수에 보정 없이 수행. Bonferroni 기준 유의 임계값 = 0.05/{N_TESTS} = {BONFERRONI_THRESHOLD:.4f}. 이 값 미만인 변수만 통계적으로 유의.",
        },
        "counts": {
            "positive_final": n_pos,
            "negative_final": n_neg,
            "zero_final_excluded": zero_n,
        },
        "publish_hour_after_16_share": {
            "positive": after_close_share(pos_rows),
            "negative": after_close_share(neg_rows),
        },
        "features": feature_tables,
        "notes_ko": interpretation,
    }

    # 콘솔 표
    print("뉴스 경로 막 봉 기준: 양수 vs 음수 (0% 제외)")
    print(f"  양수: {n_pos} | 음수: {n_neg} | 0%: {zero_n}")
    ap = after_close_share(pos_rows)
    an = after_close_share(neg_rows)
    if ap is not None and an is not None:
        print(f"  기사 공개 시각 KST 16시 이후 비율: 양수 {ap:.1%} | 음수 {an:.1%}")
    print(f"  ⚠ 다중검정 Bonferroni 임계값: 0.05 / {N_TESTS} = {BONFERRONI_THRESHOLD:.4f} "
          f"(이 값 미만만 통계적으로 유의)")
    print()
    hdr = f"{'변수':<26} {'양수 mean':>12} {'음수 mean':>12} {'p(MWU)':>10} {'유의':>6}"
    print(hdr)
    print("-" * len(hdr))
    labels = {
        "vol_ratio_eod": "거래량비(EOD/20일)",
        "event_day_ret": "이벤트일 일봉수익",
        "ret_1d_pre": "직전1일 수익(T-2→T-1)",
        "ret_5d_pre": "직전5일 수익",
        "ret_10d_pre": "직전10일 수익",
        "close_vs_ma5_pre": "종가 vs MA5(전일)",
        "close_vs_ma20_pre": "종가 vs MA20(전일)",
        "overnight_gap": "당일 시가 갭(전일종가比)",
        "open_to_anchor_pct": "시가→앵커 %",
        "pre_publish_range_pct": "공개 전 당일변동%",
        "final_ret": "최종누적수익률",
    }
    for k in keys:
        ft = feature_tables[k]
        pm = ft["positive"]["mean"]
        nm = ft["negative"]["mean"]
        pval = ft["mann_whitney_p"]
        ps = f"{pm:+.4f}" if pm is not None else "n/a"
        ns = f"{nm:+.4f}" if nm is not None else "n/a"
        pv = f"{pval:.3g}" if pval is not None else "-"
        sig = "✓" if (pval is not None and pval < BONFERRONI_THRESHOLD) else ""
        warn = " ⚠겹침" if k == "event_day_ret" else ""
        print(f"{labels.get(k, k):<26} {ps:>12} {ns:>12} {pv:>10} {sig:>6}{warn}")

    if not args.no_json:
        OUT_JSON.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print()
        print(f"저장: {OUT_JSON}")


if __name__ == "__main__":
    main()
