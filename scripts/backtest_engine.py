#!/usr/bin/env python3
"""
이벤트 기반 포지션 시뮬레이션 엔진

- EventScore 리스트를 받아 Trade 단위로 수익·리스크 계산
- 수수료 + 슬리피지 적용
- 각 이벤트 → 10분봉 경로를 따라 stop-loss / target / time-exit 시뮬레이션
- 결과: TradeResult 리스트 + BacktestStats 통계 요약
"""
from __future__ import annotations

import json
import sys
import math
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import analyze_10m_return_path as a
from event_scorer import EventScore, ScorerConfig, score_all_events


# ──────────────────────────────────────────────────────────
# 비용 설정
# ──────────────────────────────────────────────────────────

@dataclass
class CostConfig:
    commission_pct: float = 0.015 / 100    # 편도 수수료 0.015%
    tax_pct: float = 0.20 / 100           # 매도세 0.20%
    slippage_pct: float = 0.05 / 100      # 슬리피지 0.05%

    def round_trip_cost(self) -> float:
        """진입 + 청산 총 비용 비율 (소수점, %)."""
        buy  = self.commission_pct + self.slippage_pct
        sell = self.commission_pct + self.tax_pct + self.slippage_pct
        return buy + sell


# ──────────────────────────────────────────────────────────
# 시뮬레이션 설정
# ──────────────────────────────────────────────────────────

@dataclass
class SimConfig:
    max_hold_bars: int = 39       # 최대 보유 봉 수 (10분봉, 39=당일, 78=2일, 195=5일)
    partial_exit_pct: float = 0.5 # target1 도달 시 일부 청산 비율 (0 = 전량 유지)
    position_size_krw: float = 1_000_000.0  # 포지션 1건 금액 (원)

    # 고정 % 타깃 모드 (ATR 기반 대신 사용, use_fixed_pct=True 권장)
    use_fixed_pct: bool = True
    target1_pct: float = 0.01     # +1% 1차 목표
    target2_pct: float = 0.02     # +2% 2차 목표
    stop_pct: float = -0.007      # -0.7% 손절


# ──────────────────────────────────────────────────────────
# 결과 데이터클래스
# ──────────────────────────────────────────────────────────

@dataclass
class TradeResult:
    ticker: str
    t0: str
    published_at: str

    entry_price: float
    exit_price: float
    exit_reason: str      # "stop" | "target1" | "target2" | "time_exit" | "eod"
    bars_held: int

    gross_ret: float      # 수수료 전 수익률
    net_ret: float        # 수수료 후 수익률
    pnl_krw: float        # 손익 (원, 포지션 금액 기준)

    stop_loss: float | None
    target1: float | None
    target2: float | None

    # 경로 정보
    path_bars: list[float] = field(default_factory=list)  # 봉별 종가
    mae: float = 0.0   # Maximum Adverse Excursion (최대 역행)
    mfe: float = 0.0   # Maximum Favorable Excursion (최대 유리 이동)

    # 원본 스코어
    score1: int = 0
    score2: int = 0

    def to_dict(self) -> dict:
        return {
            "ticker": self.ticker,
            "t0": self.t0,
            "published_at": self.published_at,
            "entry_price": round(self.entry_price, 2),
            "exit_price": round(self.exit_price, 2),
            "exit_reason": self.exit_reason,
            "bars_held": self.bars_held,
            "gross_ret": round(self.gross_ret * 100, 4),
            "net_ret": round(self.net_ret * 100, 4),
            "pnl_krw": round(self.pnl_krw, 0),
            "stop_loss": round(self.stop_loss, 2) if self.stop_loss else None,
            "target1": round(self.target1, 2) if self.target1 else None,
            "target2": round(self.target2, 2) if self.target2 else None,
            "mae": round(self.mae * 100, 4),
            "mfe": round(self.mfe * 100, 4),
            "score1": self.score1,
            "score2": self.score2,
        }


@dataclass
class BacktestStats:
    n_trades: int = 0
    n_win: int = 0
    n_loss: int = 0

    total_net_ret: float = 0.0
    avg_net_ret: float = 0.0
    median_net_ret: float = 0.0
    win_rate: float = 0.0

    profit_factor: float = 0.0
    sharpe_ratio: float = 0.0
    max_drawdown: float = 0.0  # 양수 표기 (0.10 = 10%)

    avg_bars_held: float = 0.0
    avg_mae: float = 0.0
    avg_mfe: float = 0.0

    exit_reason_dist: dict[str, int] = field(default_factory=dict)
    score1_avg: float = 0.0
    score2_avg: float = 0.0

    def to_dict(self) -> dict:
        return {
            "n_trades": self.n_trades,
            "n_win": self.n_win,
            "n_loss": self.n_loss,
            "win_rate": round(self.win_rate * 100, 2),
            "avg_net_ret_pct": round(self.avg_net_ret * 100, 4),
            "median_net_ret_pct": round(self.median_net_ret * 100, 4),
            "total_net_ret_pct": round(self.total_net_ret * 100, 4),
            "profit_factor": round(self.profit_factor, 3),
            "sharpe_ratio": round(self.sharpe_ratio, 3),
            "max_drawdown_pct": round(self.max_drawdown * 100, 4),
            "avg_bars_held": round(self.avg_bars_held, 1),
            "avg_mae_pct": round(self.avg_mae * 100, 4),
            "avg_mfe_pct": round(self.avg_mfe * 100, 4),
            "exit_reason_dist": self.exit_reason_dist,
            "score1_avg": round(self.score1_avg, 2),
            "score2_avg": round(self.score2_avg, 2),
        }


# ──────────────────────────────────────────────────────────
# 핵심 시뮬레이션
# ──────────────────────────────────────────────────────────

def simulate_trade(
    es: EventScore,
    cost: CostConfig,
    sim: SimConfig,
) -> TradeResult | None:
    """
    단일 BUY 이벤트를 10분봉 경로로 시뮬레이션.
    stop / target1 / target2 / time_exit 중 먼저 도달한 조건으로 청산.
    """
    if es.signal != "BUY" or es.entry_price is None:
        return None

    # 진입봉 이후 10분봉 경로 로드
    # analyze_10m_return_path.extract_series_with_intraday 재활용
    mrow = es.manifest_row if getattr(es, "manifest_row", None) else _get_manifest_row(
        es.ticker, es.t0
    )
    if mrow is None:
        return None

    pack = a.extract_series_with_intraday(
        mrow["intraday_path"], es.t0, es.published_at
    )
    if pack is None:
        return None

    series, diag = pack
    if not series:
        return None

    # series는 앵커 기준 누적수익률 경로 (첫 원소 = 0.0)
    # 절대가격 복원: anchor_price * (1 + cum_ret)
    anchor_price = diag.get("anchor_price")
    if not anchor_price:
        return None

    prices = [anchor_price * (1 + r) for r in series]

    if len(prices) < 2:
        return None

    # 진입가 = 앵커 직후 첫 봉 종가 (entry_bar close)
    entry_price = es.entry_price

    # 고정 % 모드: ATR 기반 무시하고 비율로 타깃·손절 결정
    if sim.use_fixed_pct:
        stop = entry_price * (1 + sim.stop_pct)
        tgt1 = entry_price * (1 + sim.target1_pct)
        tgt2 = entry_price * (1 + sim.target2_pct)
    else:
        stop = es.stop_loss
        tgt1 = es.target1
        tgt2 = es.target2

    # 시뮬레이션: prices[0] = 앵커(진입 직전), prices[1]부터 보유
    path = prices[1:]
    exit_price = None
    exit_reason = "time_exit"
    bars_held = 0

    mae = 0.0   # 최대 역행 (양수값으로 저장)
    mfe = 0.0

    for i, p in enumerate(path[:sim.max_hold_bars]):
        bars_held = i + 1
        ret = (p - entry_price) / entry_price

        mae = max(mae, -ret)
        mfe = max(mfe, ret)

        # 손절
        if stop is not None and p <= stop:
            exit_price  = stop
            exit_reason = "stop"
            break

        # 2차 목표 (전량 청산)
        if tgt2 is not None and p >= tgt2:
            exit_price  = tgt2
            exit_reason = "target2"
            break

        # 1차 목표 (partial or hold)
        if tgt1 is not None and p >= tgt1:
            if sim.partial_exit_pct >= 1.0:
                exit_price  = tgt1
                exit_reason = "target1"
                break
            # partial: 계속 보유 (2차 목표 노림)

    if exit_price is None:
        exit_price  = path[min(bars_held - 1, len(path) - 1)]
        exit_reason = "time_exit"

    gross_ret   = (exit_price - entry_price) / entry_price
    net_ret     = gross_ret - cost.round_trip_cost()
    pnl_krw     = sim.position_size_krw * net_ret

    return TradeResult(
        ticker=es.ticker,
        t0=es.t0,
        published_at=es.published_at,
        entry_price=entry_price,
        exit_price=exit_price,
        exit_reason=exit_reason,
        bars_held=bars_held,
        gross_ret=gross_ret,
        net_ret=net_ret,
        pnl_krw=pnl_krw,
        stop_loss=stop,
        target1=tgt1,
        target2=tgt2,
        path_bars=path[:bars_held],
        mae=mae,
        mfe=mfe,
        score1=es.score1,
        score2=es.score2,
    )


def _get_manifest_row(ticker: str, t0: str) -> dict | None:
    manifest_path = a.OUT_DIR / "manifest.json"
    if not manifest_path.exists():
        return None
    rows = json.loads(manifest_path.read_text(encoding="utf-8"))
    # manifest는 ticker당 1건 (다운로드 윈도우 기준)
    for row in rows:
        if row["ticker"] == ticker:
            return row
    return None


def simulate_scored_events(
    events: list,
    cost: "CostConfig",
    sim: "SimConfig",
) -> list[TradeResult]:
    """이미 스코어된 BUY 이벤트 리스트를 시뮬레이션."""
    trades = []
    for es in events:
        es.signal = "BUY"
        tr = simulate_trade(es, cost, sim)
        if tr:
            trades.append(tr)
    return trades


# ──────────────────────────────────────────────────────────
# 통계 계산
# ──────────────────────────────────────────────────────────

def compute_stats(trades: list[TradeResult]) -> BacktestStats:
    if not trades:
        return BacktestStats()

    rets = [t.net_ret for t in trades]
    n = len(trades)
    wins   = [r for r in rets if r >= 0]
    losses = [r for r in rets if r < 0]

    # Profit Factor
    gross_win  = sum(wins)
    gross_loss = abs(sum(losses)) if losses else 0
    pf = gross_win / gross_loss if gross_loss > 0 else float("inf")

    # Sharpe (거래별, 연율화 없이 단순 평균/표준편차)
    mean_r = sum(rets) / n
    var_r  = sum((r - mean_r) ** 2 for r in rets) / (n - 1) if n > 1 else 0
    sharpe = mean_r / math.sqrt(var_r) if var_r > 0 else 0.0

    # Max Drawdown (누적 PnL 곡선 기준)
    cum_pnl = 0.0
    peak    = 0.0
    mdd     = 0.0
    for t in trades:
        cum_pnl += t.net_ret
        if cum_pnl > peak:
            peak = cum_pnl
        dd = (peak - cum_pnl)
        if dd > mdd:
            mdd = dd

    # Median
    sorted_rets = sorted(rets)
    mid = n // 2
    median = sorted_rets[mid] if n % 2 == 1 else (sorted_rets[mid - 1] + sorted_rets[mid]) / 2

    # Exit reason dist
    from collections import Counter
    exit_dist = dict(Counter(t.exit_reason for t in trades))

    return BacktestStats(
        n_trades=n,
        n_win=len(wins),
        n_loss=len(losses),
        total_net_ret=sum(rets),
        avg_net_ret=mean_r,
        median_net_ret=median,
        win_rate=len(wins) / n,
        profit_factor=pf,
        sharpe_ratio=sharpe,
        max_drawdown=mdd,
        avg_bars_held=sum(t.bars_held for t in trades) / n,
        avg_mae=sum(t.mae for t in trades) / n,
        avg_mfe=sum(t.mfe for t in trades) / n,
        exit_reason_dist=exit_dist,
        score1_avg=sum(t.score1 for t in trades) / n,
        score2_avg=sum(t.score2 for t in trades) / n,
    )


# ──────────────────────────────────────────────────────────
# 전체 백테스트
# ──────────────────────────────────────────────────────────

def run_backtest(
    scorer_cfg: ScorerConfig | None = None,
    cost_cfg: CostConfig | None = None,
    sim_cfg: SimConfig | None = None,
    verbose: bool = True,
) -> tuple[list[TradeResult], BacktestStats]:
    if scorer_cfg is None:
        scorer_cfg = ScorerConfig()
    if cost_cfg is None:
        cost_cfg = CostConfig()
    if sim_cfg is None:
        sim_cfg = SimConfig()

    if verbose:
        print("=== 이벤트 스코어링 ===")
    events = score_all_events(scorer_cfg)

    buy_events = [e for e in events if e.signal == "BUY"]
    if verbose:
        print(f"BUY 이벤트: {len(buy_events)}건 → 시뮬레이션 시작")

    trades: list[TradeResult] = []
    for es in buy_events:
        tr = simulate_trade(es, cost_cfg, sim_cfg)
        if tr is not None:
            trades.append(tr)

    stats = compute_stats(trades)

    if verbose:
        print(f"\n=== 백테스트 결과 ({len(trades)}건 체결) ===")
        print(f"승률:       {stats.win_rate:.1%}")
        print(f"평균수익:   {stats.avg_net_ret*100:.3f}%")
        print(f"중앙값:     {stats.median_net_ret*100:.3f}%")
        print(f"Profit F:   {stats.profit_factor:.2f}")
        print(f"Sharpe:     {stats.sharpe_ratio:.3f}")
        print(f"MaxDD:      {stats.max_drawdown*100:.2f}%")
        print(f"avg MAE:    {stats.avg_mae*100:.3f}%")
        print(f"avg MFE:    {stats.avg_mfe*100:.3f}%")
        print(f"exit 분포:  {stats.exit_reason_dist}")

    return trades, stats


# ──────────────────────────────────────────────────────────
# CLI
# ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="EODHD 뉴스 이벤트 백테스트")
    parser.add_argument("--s1",      type=int,   default=6,         help="score1 임계값")
    parser.add_argument("--s2",      type=int,   default=5,         help="score2 임계값")
    parser.add_argument("--hold",    type=int,   default=12,        help="최대 보유 10분봉 수")
    parser.add_argument("--size",    type=float, default=1_000_000, help="포지션 크기 (원)")
    parser.add_argument("--partial", type=float, default=0.5,       help="target1 부분청산 비율")
    parser.add_argument("--out",     type=str,   default="data/analysis/backtest_results.json")
    args = parser.parse_args()

    sc = ScorerConfig(score1_threshold=args.s1, score2_threshold=args.s2)
    cc = CostConfig()
    sm = SimConfig(max_hold_bars=args.hold, position_size_krw=args.size, partial_exit_pct=args.partial)

    trades, stats = run_backtest(sc, cc, sm)

    out = {
        "params": {
            "score1_threshold": args.s1,
            "score2_threshold": args.s2,
            "max_hold_bars": args.hold,
            "position_size_krw": args.size,
            "commission_pct": cc.commission_pct * 100,
            "slippage_pct": cc.slippage_pct * 100,
        },
        "stats": stats.to_dict(),
        "trades": [t.to_dict() for t in trades],
    }

    out_path = ROOT / args.out
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n저장: {out_path}")
