#!/usr/bin/env python3
"""
가격 반응 전략 심층 분석
- 어떤 전략이 상승을 이끌었는지
- 어떤 전략이 수익을 죽였는지
- 시장 평균 대비 기여도
"""

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
STATS_PATH = BASE / "data" / "advanced_stats.json"


def main():
    with open(STATS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    perf = {r["strategy"]: r for r in data["strategy_performance"]}

    baseline = perf["Baseline"]
    strategies = [
        ("Strategy A", "Volume Spike", "거래량 3배+ (과열)"),
        ("Strategy B", "Gap Momentum", "갭상승 2%+ 양봉 (급등)"),
        ("Strategy C", "Oversold Reversal", "과매도 반등"),
        ("Strategy D", "Healthy Reaction", "건강한 반응"),
    ]

    print("=" * 70)
    print("가격 반응 전략 심층 분석")
    print("=" * 70)
    print()

    # 0. 시장 평균(669건) 심층분석
    deep = data.get("market_baseline_deep")
    if deep:
        bl = deep.get("baseline_returns_pct", {})
        print("【시장 평균(669건) 심층분석】")
        print("-" * 50)
        print(f"  전체: {deep['total']}건 | 1일 {bl.get('1d', 0)}% | 5일 {bl.get('5d', 0)}% | 7일 {bl.get('7d', 0)}% | 10일 {bl.get('10d', 0)}%")
        print()
        for g in deep.get("groups", []):
            print(f"  • {g['label']} ({g['count']}건, {g['pct_of_total']}%)")
            print(f"    {g['desc']}")
            print(f"    1일 {g['avg_ret_1d_pct']:+.2f}% (기여 {g['contrib_1d_pp']:+.3f}%p) | 5일 {g['avg_ret_5d_pct']:+.2f}% (기여 {g['contrib_5d_pp']:+.3f}%p)")
            print(f"    7일 {g['avg_ret_7d_pct']:+.2f}% | 10일 {g['avg_ret_10d_pct']:+.2f}%")
            print()
        print(f"  → {deep.get('insight', '')}")
        print()
    print()

    print("【기준】시장 평균 (669건)")
    print("  - 뉴스 노출 종목 전체, 전략 무관")
    print("  - 1일: 0.46% | 5일: 3.15% | 7일: 5.19% | 10일: 8.72%")
    print()

    # 1. 상승을 이끈 전략
    print("【상승을 이끈 전략】시장 평균 대비 우수")
    print("-" * 50)
    for key, name, desc in strategies:
        r = perf.get(key, {})
        ret_1d = r.get("avg_ret_1d", 0) or 0
        ret_5d = r.get("avg_ret_5d", 0) or 0
        ret_7d = r.get("avg_ret_7d", 0) or 0
        ret_10d = r.get("avg_ret_10d", 0) or 0
        bl_1d = baseline.get("avg_ret_1d", 0) or 0
        bl_5d = baseline.get("avg_ret_5d", 0) or 0
        bl_7d = baseline.get("avg_ret_7d", 0) or 0
        bl_10d = baseline.get("avg_ret_10d", 0) or 0

        if ret_1d > bl_1d and ret_5d > bl_5d:
            diff_1d = (ret_1d - bl_1d) * 100
            diff_5d = (ret_5d - bl_5d) * 100
            print(f"  ✓ {name} ({r.get('count', 0)}건)")
            print(f"    {desc}")
            print(f"    1일: {ret_1d*100:+.2f}% (시장 대비 {diff_1d:+.2f}%p)")
            print(f"    5일: {ret_5d*100:+.2f}% (시장 대비 {diff_5d:+.2f}%p)")
            print(f"    10일: {ret_10d*100:+.2f}% (시장 8.72% 대비)")
            print()
    print()

    # 2. 수익을 죽인 전략
    print("【수익을 죽인 전략】단기 마이너스 또는 시장 대비 열위")
    print("-" * 50)
    for key, name, desc in strategies:
        r = perf.get(key, {})
        ret_1d = r.get("avg_ret_1d", 0) or 0
        ret_5d = r.get("avg_ret_5d", 0) or 0
        ret_7d = r.get("avg_ret_7d", 0) or 0
        wr_1d = r.get("win_rate_1d", 0) or 0

        if ret_1d < 0 or ret_5d < 0:
            print(f"  ✗ {name} ({r.get('count', 0)}건)")
            print(f"    {desc}")
            print(f"    1일: {ret_1d*100:+.2f}% (승률 {wr_1d*100:.1f}%)")
            print(f"    5일: {ret_5d*100:+.2f}% | 7일: {ret_7d*100:+.2f}%")
            print(f"    → 단기 과열/급등 후 조정, 10일까지 보유 시 회복 가능")
            print()
    print()

    # 3. 시장 평균 구성 기여 (가중 평균 근사)
    print("【시장 평균을 만드는 요인】")
    print("-" * 50)
    print("  시장 평균 = A·B·C·D 등 모든 패턴이 섞인 결과")
    print("  - A(45건), B(34건): 단기 마이너스 → 전체 평균을 끌어내림")
    print("  - C(58건), D(24건): 플러스 → 전체 평균을 끌어올림")
    print()
    total_abcd = 45 + 34 + 58 + 24  # 161건, 일부 중복 가능
    print("  A+B = 79건 (약 12%): 평균 -0.8%~-1.2% (1~5일)")
    print("  C+D = 82건 (약 12%): 평균 +2%~+7% (1~5일)")
    print("  → C, D가 시장 평균을 상승시키고, A, B가 하락시킴")
    print()

    # 4. 핵심 인사이트
    print("【핵심 인사이트】")
    print("-" * 50)
    print("  1. Volume Spike(A): 거래량 폭증 = 과열 신호 → 1~7일 -1%~-2%")
    print("  2. Gap Momentum(B): 갭상승+양봉 = 급등 신호 → 1~5일 마이너스, 10일 12%로 회복")
    print("  3. Oversold Reversal(C): 과매도 반등 = 건전한 반등 → 전 구간 +2%~+12%")
    print("  4. Healthy Reaction(D): 적당한 반응 = 최고 성과 → 10일 25.9%")
    print()
    print("  실전: A·B 패턴이면 관망, C·D 패턴이면 매수 유리")
    print("=" * 70)


if __name__ == "__main__":
    main()
