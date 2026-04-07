#!/usr/bin/env python3
"""
이벤트별 매매 시그널 스코어러

score_1 : 이벤트 전날 EOD 기반 사전 스크리닝 (0 ~ 10점)
score_2 : 당일 5분봉 앵커 전 인트라데이 확인 (0 ~ 8점)
entry_trigger : 앵커 다음 10분봉 진입 확인 (bool)

단일 이벤트 → EventScore(dataclass) 반환.
전체 이벤트 배치 → score_all_events() 로 list[EventScore] 반환.
"""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import indicators as ind
import analyze_10m_return_path as a
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)

KST = ZoneInfo("Asia/Seoul")


# ──────────────────────────────────────────────────────────
# 결과 데이터클래스
# ──────────────────────────────────────────────────────────

@dataclass
class ScoreDetail:
    """개별 평가 항목 상세."""
    name: str
    value: Any
    points: int
    max_points: int
    reason: str = ""


@dataclass
class EventScore:
    ticker: str
    t0: str
    published_at: str

    # 백테스트·경로 로드용 (per-article manifest 행 등). 직렬화 생략.
    manifest_row: dict | None = None

    # 1단계 EOD 스냅샷
    eod_snap: dict = field(default_factory=dict)
    score1: int = 0
    score1_max: int = 10
    score1_details: list[ScoreDetail] = field(default_factory=list)
    score1_pass: bool = False

    # 2단계 인트라데이 스냅샷
    intra_snap: dict = field(default_factory=dict)
    score2: int = 0
    score2_max: int = 8
    score2_details: list[ScoreDetail] = field(default_factory=list)
    score2_pass: bool = False

    # 3단계 진입 트리거
    entry_bar: dict = field(default_factory=dict)
    entry_trigger: bool = False
    entry_price: float | None = None
    entry_atr10m: float | None = None

    # 리스크 레벨
    stop_loss: float | None = None
    target1: float | None = None
    target2: float | None = None

    # 최종 시그널
    signal: str = "SKIP"  # BUY | SKIP
    skip_reason: str = ""

    def to_dict(self) -> dict:
        d = {
            "ticker": self.ticker,
            "t0": self.t0,
            "published_at": self.published_at,
            "score1": self.score1,
            "score1_pass": self.score1_pass,
            "score2": self.score2,
            "score2_pass": self.score2_pass,
            "entry_trigger": self.entry_trigger,
            "entry_price": self.entry_price,
            "stop_loss": self.stop_loss,
            "target1": self.target1,
            "target2": self.target2,
            "signal": self.signal,
            "skip_reason": self.skip_reason,
            "eod": self.eod_snap,
            "intraday": self.intra_snap,
            "score1_details": [
                {"name": d.name, "value": d.value, "points": d.points, "max": d.max_points, "reason": d.reason}
                for d in self.score1_details
            ],
            "score2_details": [
                {"name": d.name, "value": d.value, "points": d.points, "max": d.max_points, "reason": d.reason}
                for d in self.score2_details
            ],
        }
        return d


# ──────────────────────────────────────────────────────────
# 임계값 설정 (워크포워드에서 최적화 대상)
# ──────────────────────────────────────────────────────────

@dataclass
class ScorerConfig:
    # 1단계 임계값
    score1_threshold: int = 6

    # RSI 범위
    rsi_low: float = 35
    rsi_high: float = 65

    # BB pct_b 범위 (BB 안쪽)
    bb_pct_b_low: float = 0.1
    bb_pct_b_high: float = 0.75

    # MA60 이격 하한 (너무 많이 빠진 것 제외)
    ma60_gap_min: float = -0.10

    # 거래량비 상한 (과열 제외)
    vol_ratio_max: float = 4.0

    # 공개 시각 (장중 기준, KST 시)
    pub_hour_cutoff: int = 15

    # 2단계 임계값
    score2_threshold: int = 5

    # 시가→앵커 낙폭 허용 하한 (%)
    open_to_anchor_min: float = -0.5

    # 공개 전 변동폭 상한 (%)
    pre_publish_range_max: float = 1.5

    # 3단계 진입 트리거
    entry_body_ratio_min: float = 0.35
    entry_vol_vs_avg_min: float = 0.6

    # ATR 배수 (스탑·타깃)
    stop_atr_mult: float = 1.5
    target1_atr_mult: float = 2.0
    target2_atr_mult: float = 3.5


# ──────────────────────────────────────────────────────────
# 1단계: EOD 사전 스크리닝
# ──────────────────────────────────────────────────────────

def compute_score1(eod_snap: dict, pub_hour_kst: int | None, cfg: ScorerConfig) -> tuple[int, list[ScoreDetail]]:
    """0~10점 EOD 스크리닝 스코어."""
    details: list[ScoreDetail] = []
    total = 0

    def add(name: str, value: Any, pts: int, max_pts: int, reason: str = "") -> None:
        nonlocal total
        details.append(ScoreDetail(name, value, pts, max_pts, reason))
        total += pts

    # ── 추세 (max 3점) ──
    ma5_above = eod_snap.get("ma5_above_ma20")
    add("MA5 > MA20", ma5_above,
        1 if ma5_above else 0, 1,
        "단기 추세 상향" if ma5_above else "단기 추세 하향")

    ma20_above = eod_snap.get("ma20_above_ma60")
    add("MA20 > MA60", ma20_above,
        1 if ma20_above else 0, 1,
        "중기 추세 상향" if ma20_above else "중기 추세 하향")

    slope = eod_snap.get("ma20_slope5")
    slope_ok = slope is not None and slope > 0
    add("MA20 기울기 +", slope, 1 if slope_ok else 0, 1,
        f"MA20 상승중({slope:.4f})" if slope_ok else "MA20 하락/횡보")

    # ── 모멘텀 (max 2점) ──
    rsi_v = eod_snap.get("rsi14")
    rsi_ok = rsi_v is not None and cfg.rsi_low < rsi_v < cfg.rsi_high
    add("RSI 40~65", rsi_v,
        1 if rsi_ok else 0, 1,
        f"RSI {rsi_v:.1f} 적정 구간" if rsi_ok else f"RSI {rsi_v:.1f} 범위 밖")

    macd_ok = eod_snap.get("macd_above_signal")
    add("MACD > 시그널", macd_ok,
        1 if macd_ok else 0, 1,
        "MACD 상향" if macd_ok else "MACD 하향")

    # ── 변동성·위치 (max 2점) ──
    bb_pct = eod_snap.get("bb_pct_b")
    bb_ok = bb_pct is not None and cfg.bb_pct_b_low < bb_pct < cfg.bb_pct_b_high
    add("BB 위치", bb_pct,
        1 if bb_ok else 0, 1,
        f"BB pct_b={bb_pct:.2f} 중간대" if bb_ok else f"BB pct_b={bb_pct:.2f} 과열/과매도")

    ma60_gap = eod_snap.get("ma60_gap")
    gap_ok = ma60_gap is not None and ma60_gap >= cfg.ma60_gap_min
    add("MA60 이격", ma60_gap,
        1 if gap_ok else 0, 1,
        f"MA60 대비 {ma60_gap:.2%}" if ma60_gap is not None else "데이터 없음")

    # ── 거래량 (max 2점) ──
    vol_r = eod_snap.get("vol_ratio_20d")
    vol_ok = vol_r is not None and 0.3 < vol_r < cfg.vol_ratio_max
    add("거래량비 0.3~4×", vol_r,
        1 if vol_ok else 0, 1,
        f"Vol ratio {vol_r:.2f}×" if vol_r is not None else "데이터 없음")

    obv_s = eod_snap.get("obv_slope5")
    obv_ok = obv_s is not None and obv_s > 0
    add("OBV 기울기 +", obv_s,
        1 if obv_ok else 0, 1,
        f"OBV 상승({obv_s:.4f})" if obv_ok else "OBV 하락")

    # ── 공개 시각 (max 1점) ──
    pub_ok = pub_hour_kst is not None and pub_hour_kst < cfg.pub_hour_cutoff
    add("공개시각 < 15시", pub_hour_kst,
        1 if pub_ok else 0, 1,
        f"KST {pub_hour_kst}시" if pub_hour_kst is not None else "시각 불명")

    return total, details


# ──────────────────────────────────────────────────────────
# 2단계: 인트라데이 확인
# ──────────────────────────────────────────────────────────

def compute_score2(intra_snap: dict, cfg: ScorerConfig) -> tuple[int, list[ScoreDetail]]:
    """0~8점 인트라데이 확인 스코어."""
    details: list[ScoreDetail] = []
    total = 0

    def add(name: str, value: Any, pts: int, max_pts: int, reason: str = "") -> None:
        nonlocal total
        details.append(ScoreDetail(name, value, pts, max_pts, reason))
        total += pts

    # ── VWAP 위치 (max 2점) ──
    avw = intra_snap.get("anchor_vs_vwap")
    if avw is not None:
        pts = 2 if avw >= 0 else (1 if avw >= -0.003 else 0)
        add("앵커 vs VWAP", avw, pts, 2,
            f"앵커 VWAP {'위' if avw >= 0 else '근방' if avw >= -0.003 else '아래'}")
    else:
        add("앵커 vs VWAP", None, 0, 2, "데이터 없음")

    # ── 공개 전 변동폭 (max 2점) ──
    ppr = intra_snap.get("pre_publish_range_pct")
    if ppr is not None:
        pts = 2 if ppr < 0.8 else (1 if ppr < cfg.pre_publish_range_max else 0)
        add("공개 전 변동폭", ppr, pts, 2,
            f"{ppr:.2f}% ({'안정' if ppr < 0.8 else '보통' if ppr < 1.5 else '과열'})")
    else:
        add("공개 전 변동폭", None, 0, 2, "데이터 없음")

    # ── 시가→앵커 (max 2점) ──
    o2a = intra_snap.get("open_to_anchor_pct")
    if o2a is not None:
        pts = 2 if o2a >= 0 else (1 if o2a >= cfg.open_to_anchor_min else 0)
        add("시가→앵커 낙폭", o2a, pts, 2,
            f"{o2a:.2f}% ({'상승' if o2a >= 0 else '소폭 하락' if o2a >= -0.5 else '급락'})")
    else:
        add("시가→앵커 낙폭", None, 0, 2, "데이터 없음")

    # ── 앵커 직전 모멘텀 (max 2점) ──
    roc3 = intra_snap.get("pre_anchor_roc3")
    if roc3 is not None:
        pct = roc3 * 100
        pts = 2 if pct > 0.1 else (1 if pct >= -0.2 else 0)
        add("앵커 직전 ROC(3)", pct, pts, 2,
            f"{pct:.2f}% ({'상승' if pct > 0.1 else '횡보' if pct >= -0.2 else '하락'})")
    else:
        add("앵커 직전 ROC(3)", None, 0, 2, "데이터 없음")

    return total, details


# ──────────────────────────────────────────────────────────
# 3단계: 진입 트리거
# ──────────────────────────────────────────────────────────

def compute_entry_trigger(
    entry_bar: dict,
    anchor_close: float,
    daily_avg_vol: float | None,
    atr_10m: float | None,
    cfg: ScorerConfig,
) -> tuple[bool, float | None, float | None, float | None]:
    """
    Returns (triggered, stop_loss, target1, target2).
    """
    feats = ind.entry_bar_features(entry_bar, daily_avg_vol)
    bullish = feats["is_bullish"]
    body_ok = feats["body_ratio"] >= cfg.entry_body_ratio_min
    vol_ok = (
        feats["vol_vs_avg"] is None  # 거래량 데이터 없으면 조건 완화
        or feats["vol_vs_avg"] >= cfg.entry_vol_vs_avg_min
    )
    triggered = bullish and body_ok and vol_ok

    stop_loss = target1 = target2 = None
    if triggered and atr_10m and atr_10m > 0:
        ep = feats["close"]
        stop_loss = ep - cfg.stop_atr_mult   * atr_10m
        target1   = ep + cfg.target1_atr_mult * atr_10m
        target2   = ep + cfg.target2_atr_mult * atr_10m

    return triggered, stop_loss, target1, target2


# ──────────────────────────────────────────────────────────
# 단일 이벤트 채점
# ──────────────────────────────────────────────────────────

def score_event(
    ev: dict,
    manifest_row: dict,
    cfg: ScorerConfig | None = None,
) -> EventScore:
    """
    ev           : iter_article_ticker_events() 의 한 행
    manifest_row : ev["manifest_row"]
    """
    if cfg is None:
        cfg = ScorerConfig()

    es = EventScore(
        ticker=ev["ticker"],
        t0=ev["t0"],
        published_at=ev["published_at"],
        manifest_row=manifest_row,
    )

    # ── EOD 데이터 로드 ──
    eod_bars = a.load_eod_bars(manifest_row["eod_path"]) if manifest_row.get("eod_ok") else []
    t0 = date.fromisoformat(ev["t0"])
    # 이벤트일 인덱스 (이벤트 전날까지만 snapshot에 사용)
    eod_dates = [date.fromisoformat(b["date"]) for b in eod_bars]
    ei = next((i for i, d in enumerate(eod_dates) if d >= t0), None)
    if ei is None or ei < 20:
        es.skip_reason = f"EOD 데이터 부족 (ei={ei})"
        return es

    pre_eod = eod_bars[:ei]   # 이벤트일 이전까지
    eod_snap = ind.eod_snapshot(pre_eod)
    es.eod_snap = eod_snap

    # 공개 시각 KST 시
    pub_hour_kst: int | None = None
    try:
        from analyze_10m_return_path import parse_publish_utc_naive
        pu = parse_publish_utc_naive(ev["published_at"])
        pub_hour_kst = pu.replace(tzinfo=timezone.utc).astimezone(KST).hour
    except Exception:
        pass

    # 1단계
    s1, d1 = compute_score1(eod_snap, pub_hour_kst, cfg)
    es.score1 = s1
    es.score1_details = d1
    es.score1_pass = s1 >= cfg.score1_threshold
    if not es.score1_pass:
        es.skip_reason = f"score1={s1} < {cfg.score1_threshold}"
        return es

    # ── 인트라데이 데이터 로드 ──
    pack = a.extract_series_with_intraday(
        manifest_row["intraday_path"], ev["t0"], ev["published_at"]
    )
    if pack is None:
        es.skip_reason = "5분봉 경로 구성 실패"
        return es

    series, diag = pack

    # 앵커 및 인트라데이 지표
    bars_5m_all = a.load_intraday_bars(manifest_row["intraday_path"])
    market_5m = [b for b in bars_5m_all if isinstance(b.get("datetime"), str) and a.is_market_bar(b["datetime"])]
    by_day = a.group_by_date(market_5m)
    trading_days = sorted(by_day.keys())
    ev_idx = None
    for i, dk in enumerate(trading_days):
        sk = a.first_session_kst_date(dk, by_day)
        if sk is not None and sk >= t0:
            ev_idx = i
            break
    if ev_idx is None:
        es.skip_reason = "이벤트일 5분봉 없음"
        return es

    try:
        publish_utc = a.parse_publish_utc_naive(ev["published_at"].strip())
    except Exception:
        es.skip_reason = "published_at 파싱 실패"
        return es

    _, anchor_bar_end = a.anchor_close_first_on_or_after_publish(
        by_day, trading_days, ev_idx, publish_utc
    )

    session_bars = sorted(by_day.get(trading_days[ev_idx], []), key=lambda x: x["datetime"])
    intra_snap = ind.intraday_snapshot(session_bars, anchor_bar_end, publish_utc)
    es.intra_snap = intra_snap

    # 2단계
    s2, d2 = compute_score2(intra_snap, cfg)
    es.score2 = s2
    es.score2_details = d2
    es.score2_pass = s2 >= cfg.score2_threshold
    if not es.score2_pass:
        es.skip_reason = f"score2={s2} < {cfg.score2_threshold}"
        return es

    # ── 진입봉 (앵커 다음 10분봉) ──
    # anchor 이후 봉들만 모아 10분봉 변환
    if anchor_bar_end is not None:
        post_anchor_5m = [b for b in session_bars if a.fivem_end_utc_naive(b["datetime"]) > anchor_bar_end]
    else:
        post_anchor_5m = session_bars

    if len(post_anchor_5m) < 2:
        es.skip_reason = "앵커 이후 봉 부족"
        return es

    bars_10m_post = a.to_10m_bars(post_anchor_5m)
    if not bars_10m_post:
        es.skip_reason = "10분봉 변환 실패"
        return es

    entry_bar = bars_10m_post[0]
    es.entry_bar = entry_bar

    # 당일 평균 봉 거래량 (10분봉 기준)
    all_10m = a.to_10m_bars(session_bars)
    daily_avg_vol_10m = (
        sum(float(b.get("volume") or 0) for b in all_10m) / len(all_10m)
        if all_10m else None
    )

    # ATR (앵커 이전 10분봉으로 계산)
    pre_anchor_5m = [b for b in session_bars if a.fivem_end_utc_naive(b["datetime"]) <= anchor_bar_end] if anchor_bar_end else session_bars
    pre_10m = a.to_10m_bars(pre_anchor_5m)
    atr_10m = ind.atr_last(pre_10m, min(14, max(3, len(pre_10m) - 1))) if len(pre_10m) >= 3 else None
    # 데이터가 부족하면 이전 날 ATR 보완
    if atr_10m is None and ev_idx > 0:
        prev_day_bars = sorted(by_day.get(trading_days[ev_idx - 1], []), key=lambda x: x["datetime"])
        prev_10m = a.to_10m_bars(prev_day_bars)
        atr_10m = ind.atr_last(prev_10m, min(14, len(prev_10m) - 1)) if len(prev_10m) >= 3 else None

    anchor_close = intra_snap.get("anchor_close")

    triggered, stop_loss, target1, target2 = compute_entry_trigger(
        entry_bar, anchor_close or 0.0, daily_avg_vol_10m, atr_10m, cfg
    )

    es.entry_trigger = triggered
    es.entry_price = float(entry_bar["close"]) if triggered else None
    es.entry_atr10m = atr_10m
    es.stop_loss = stop_loss
    es.target1 = target1
    es.target2 = target2

    if triggered:
        es.signal = "BUY"
    else:
        es.skip_reason = "진입 트리거 미충족 (비양봉 또는 바디/거래량 부족)"

    return es


# ──────────────────────────────────────────────────────────
# 전체 이벤트 배치 채점
# ──────────────────────────────────────────────────────────

def score_all_events(cfg: ScorerConfig | None = None) -> list[EventScore]:
    if cfg is None:
        cfg = ScorerConfig()

    articles_path = default_articles_path(ROOT)
    mbt, pak = resolve_manifest_sources(a.OUT_DIR)
    if mbt is None and pak is None:
        raise SystemExit(
            f"manifest 없음: {a.OUT_DIR / 'per_article/manifest_per_article.json'} 또는 manifest.json"
        )
    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    results: list[EventScore] = []
    n_total = n_buy = n_skip = 0

    for ev in iter_article_ticker_events(
        articles_path, **iter_kw, require_intraday=True, require_eod=True
    ):
        n_total += 1
        es = score_event(ev, ev["manifest_row"], cfg)
        results.append(es)
        if es.signal == "BUY":
            n_buy += 1
        else:
            n_skip += 1

    print(f"전체: {n_total} | BUY: {n_buy} ({n_buy/n_total:.1%}) | SKIP: {n_skip}")
    return results


# ──────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="이벤트 스코어 계산")
    parser.add_argument("--s1", type=int, default=6, help="1단계 임계값 (기본 6)")
    parser.add_argument("--s2", type=int, default=5, help="2단계 임계값 (기본 5)")
    parser.add_argument("--out", type=str, default="data/analysis/event_scores.json", help="출력 JSON 경로")
    args = parser.parse_args()

    cfg = ScorerConfig(score1_threshold=args.s1, score2_threshold=args.s2)
    results = score_all_events(cfg)

    out_path = ROOT / args.out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps([r.to_dict() for r in results], ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"저장: {out_path}")

    # 간단 통계 출력
    buy_scores = [r for r in results if r.signal == "BUY"]
    if buy_scores:
        print(f"\n─ BUY 시그널 {len(buy_scores)}건 ─")
        print(f"score1 평균: {sum(r.score1 for r in buy_scores)/len(buy_scores):.1f}")
        print(f"score2 평균: {sum(r.score2 for r in buy_scores)/len(buy_scores):.1f}")
        eps = [r.entry_price for r in buy_scores if r.entry_price]
        print(f"진입가 중앙값: {sorted(eps)[len(eps)//2]:,.0f}원" if eps else "")
