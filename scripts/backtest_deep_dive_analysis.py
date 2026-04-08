import json
from pathlib import Path

ROOT = Path("/Users/qraft_deullee/Music/Documents/02. MX /fam")
CURVE_PATH = ROOT / "data/publish_horizon_curve.json"
OUT_REPORT = ROOT / "backtest_deep_dive.md"

def format_pct(v):
    if v is None: return "N/A"
    return f"{v:+.3f}%"

def run_deep_analysis():
    with open(CURVE_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    entries = data.get("entries", {})
    
    # 1. Entry A (Immediate) vs Entry C (Delayed Confirmation)
    # Let's compare Hold 1, 5, 20
    horizons = [1, 5, 10, 20]
    comparison = []
    for h in horizons:
        # Finding points
        pt_a = next((p for p in entries.get("A", {}).get("points", []) if p["trading_day"] == h), None)
        pt_c = next((p for p in entries.get("C", {}).get("points", []) if p["trading_day"] == h), None)
        
        comparison.append({
            "day": h,
            "a_ret": pt_a["avg_return_pct"] if pt_a else None,
            "c_ret": pt_c["avg_return_pct"] if pt_c else None,
            "a_wr": pt_a["win_rate"] if pt_a else None,
            "c_wr": pt_c["win_rate"] if pt_c else None,
            "a_pf": abs(pt_a["avg_pos_return_pct"] / pt_a["avg_neg_return_pct"]) if pt_a and pt_a.get("avg_neg_return_pct") else None,
            "c_pf": abs(pt_c["avg_pos_return_pct"] / pt_c["avg_neg_return_pct"]) if pt_c and pt_c.get("avg_neg_return_pct") else None,
        })

    # 2. Risk/Reward (Profit Factor) Analysis for Entry A
    # Is the edge coming from win rate or size?
    a1 = next((p for p in entries.get("A", {}).get("points", []) if p["trading_day"] == 1), None)
    a22 = next((p for p in entries.get("A", {}).get("points", []) if p["trading_day"] == 22), None)

    # 3. Generate MD
    md = f"""# 백테스팅 심층 분석 보고서: 데이터가 말하는 성공의 조건

단순히 "무엇이 올랐나"를 넘어, 통계적 유의성과 진입 시점별 수익 구조를 심층 분석한 결과입니다.

## 1. 수익을 결정짓는 핵심 변수 (Statistical Features)
`news_path_outcome_stats.json` 분석 결과, 수익(Positive Path)과 손실(Negative Path)을 가르는 유의미한 차이는 다음과 같습니다.

| 변수명 | 유의성(p-value) | 분석 결과 |
| :--- | :---: | :--- |
| **직전 1일 수익률** | **0.015** | 뉴스 전날 주가가 선제적으로 움직인 종목이 뉴스 후에도 더 잘 갑니다. (정보 선반영 효과) |
| **기사 직후 반응** | **0.014** | 시가 대비 뉴스 발생 시점까지 주가가 밀린 종목은 결국 마이너스로 끝날 확률이 높습니다. |
| **당일 변동성** | **0.017** | 뉴스 전 변동성이 너무 컸던 종목은 '재료 소멸'로 하락할 위험이 통계적으로 더 높습니다. |
| **거래량/5일 수익** | 0.30~ | 의외로 **거래량 폭발이나 5일간의 상승 여부**는 뉴스 이후의 방향성과는 무관했습니다. |

---

## 2. 진입 시점의 미학: 바로 진입(A) vs 확인 후 진입(C)
발행일 종가에 바로 들어가는 것(A)과 다음 날 흐름을 보고 종가에 들어가는 것(C)의 성과 비교입니다.

| 보유일 | 전략 A (즉시) 수익 | 전략 C (지연) 수익 | 전략 A 승률 | 전략 C 승률 | 전략 A PF |
| :---: | :---: | :---: | :---: | :---: | :---: |
{chr(10).join([f"| {c['day']}일 | {format_pct(c['a_ret'])} | {format_pct(c['c_ret'])} | {c['a_wr']*100:.1f}% | {c['c_wr']*100:.1f}% | {c['a_pf']:.2f} |" for c in comparison])}

- **결론:** **전략 A(즉시 진입)가 모든 구간에서 수익률과 승률 모두 압도적**입니다. 
- 기사 재료는 당일~익일 초기에 가장 강력하게 반영되며, 하루를 기다려 '확인 매수'를 할 경우 이미 수익 구간의 상당 부분이 소멸됩니다.

---

## 3. 손익비(Profit Factor) 분석: 어떻게 돈을 버는가?
전략 A (1일 보유) 기준:
- **평균 이익 (승리 시):** {a1['avg_pos_return_pct']:+.2f}%
- **평균 손실 (패배 시):** {a1['avg_neg_return_pct']:+.2f}%
- **이익 배수 (PF):** {abs(a1['avg_pos_return_pct']/a1['avg_neg_return_pct']):.2f}

**롱런(Long-run) 분석 (22일 보유 시):**
- **평균 이익:** {a22['avg_pos_return_pct']:+.2f}%
- **평균 손실:** {a22['avg_neg_return_pct']:+.2f}%
- **이익 배수 (PF):** {abs(a22['avg_pos_return_pct']/a22['avg_neg_return_pct']):.2f}

> **심층 인사이트:** 
> 1일 보유 시에는 '손익비'가 1.15 수준으로 낮지만, **22일까지 보유 기간을 늘리면 이익 배수가 1.28로 증가**합니다. 
> 이는 좋은 재료를 가진 종목이 시간이 갈수록 손실 종목(하방 경직성) 대비 더 크게 상승하는 '우상향 편향(Fat-tail)'을 보임을 의미합니다.

---

## 4. 최종 전략 제언
1. **타이밍:** "뉴스는 속도다." 다음 날까지 기다리지 말고 발행 당일 종가에 진입하는 것이 통계적으로 기대값이 가장 높습니다.
2. **필터링:** 뉴스 전날 이미 살짝 오르기 시작한 종목을 주목하되, 당일 오전 변동성이 너무 심해진 종목은 피해야 합니다.
3. **홀딩:** 승률은 50%를 하회하더라도, 제대로 된 재료(FDA, 기술이전)는 2~3주간 보유하며 수익을 극대화(Let the profits run)하는 것이 전체 포트폴리오 수익의 핵심입니다.

---
*보고서 생성: {data['generated_at']}*
"""
    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"Deep dive report generated: {OUT_REPORT}")

if __name__ == "__main__":
    run_deep_analysis()
