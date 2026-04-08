import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from datetime import datetime

# Paths
ROOT = Path("/Users/qraft_deullee/Music/Documents/02. MX /fam")
CURVE_PATH = ROOT / "data/publish_horizon_curve.json"
TICKERS_PATH = ROOT / "data/somedaynews_article_tickers.json"
OUT_REPORT = ROOT / "backtest_detailed_report.md"

# 그리드 서치(평균 수익·n≥500) 상위 조합: E × 18거래일
DEFAULT_ENTRY = "E"
DEFAULT_HOLD_DAYS = 18

# Categorization patterns from analyze_publish_5d_article_themes.py
CATEGORIES = [
    ("FDA·미국규제", [r"FDA", r"NDA", r"BLA", r"IND", r"PDUFA", r"브레이크스루", r"Breakthrough", r"Fast\s+Track", r"오펀", r"Orphan", r"EMA", r"미국\s*식품의약국"]),
    ("EU·체외진단", [r"IVDR", r"MDR", r"CE", r"체외진단"]),
    ("국내허가·식약처", [r"식약처", r"품목허가", r"조건부허가", r"신약허가", r"허가신청", r"승인", r"보험수가"]),
    ("임상·결과", [r"임상", r"1상", r"2상", r"3상", r"Phase", r"중간\s*분석", r"최종\s*분석", r"p값", r"유의미", r"엔드포인트", r"CAR[- ]?T", r"투약\s*종료", r"중간발표"]),
    ("기술이전·수출", [r"기술이전", r"기술수출", r"기술도입", r"Tech\s+Transfer", r"라이선스", r"License", r"공급계약", r"독점\s*판매", r"판권", r"수주", r"MOU", r"업무협약", r"MTA"]),
    ("자금·CB·유증", [r"유상증자", r"전환사채", r"CB\s*발행", r"신주인수", r"자금\s*조달", r"투자유치", r"프리IPO", r"공모"]),
    ("M&A·지분", [r"인수", r"매각", r"M&A", r"지분\s*투자", r"지분\s*매입", r"합병", r"스핀오프", r"엑시트"]),
    ("실적·가이던스", [r"실적", r"매출", r"영업이익", r"영업손실", r"흑자", r"적자", r"어닝", r"가이던스"]),
    ("특허·분쟁", [r"특허", r"소송", r"침해", r"ITC", r"무효심판"]),
    ("거래·공시", [r"관리종목", r"거래정지", r"상장폐지", r"불성실", r"감사보고서"]),
    ("시황·테마", [r"테마주", r"상한가", r"급등", r"껑충", r"주가", r"시총"]),
]

def get_tags(title):
    tags = []
    for label, pats in CATEGORIES:
        if any(re.search(p, title, re.IGNORECASE) for p in pats):
            tags.append(label)
    return tags if tags else ["기타·미분류"]

def run_analysis():
    print("Loading data...")
    with open(CURVE_PATH, "r", encoding="utf-8") as f:
        curve = json.load(f)
    with open(TICKERS_PATH, "r", encoding="utf-8") as f:
        raw_tickers = json.load(f)

    # 1. Build Ticker -> List of Titles
    ticker_to_titles = defaultdict(list)
    for item in raw_tickers:
        for code in item.get("stock_codes", []):
            ticker_to_titles[code].append(item.get("title", ""))

    # 2. Ticker attribution for chosen entry × hold (must exist in publish_horizon_curve.json)
    hold_key = str(DEFAULT_HOLD_DAYS)
    entry_meta = curve.get("entries", {}).get(DEFAULT_ENTRY, {})
    entry_label = entry_meta.get("label", DEFAULT_ENTRY)
    attr_list = curve.get("ticker_attribution", {}).get(DEFAULT_ENTRY, {}).get(hold_key, [])
    if not attr_list:
        print(f"Error: No ticker_attribution for entry={DEFAULT_ENTRY}, hold={hold_key}. Regenerate curve: python3 scripts/entry_hold_analysis.py")
        return

    # Sort by return
    sorted_attr = sorted(attr_list, key=lambda x: x["avg_return_pct"], reverse=True)
    top_20 = sorted_attr[:20]
    bottom_20 = sorted_attr[-20:]

    # 3. Analyze Themes for Winners vs Losers
    def analyze_group(group):
        theme_counter = Counter()
        group_details = []
        for item in group:
            ticker = item["ticker"]
            ret = item["avg_return_pct"]
            titles = ticker_to_titles.get(ticker, ["(No Title Found)"])
            # Get unique tags for all titles of this ticker
            all_tags = set()
            for t in titles:
                for tg in get_tags(t):
                    all_tags.add(tg)
            for tg in all_tags:
                theme_counter[tg] += 1
            
            group_details.append({
                "ticker": ticker,
                "ret": ret,
                "count": item["count"],
                "tags": list(all_tags),
                "top_title": titles[0] if titles else ""
            })
        return theme_counter, group_details

    win_themes, win_details = analyze_group(top_20)
    loss_themes, loss_details = analyze_group(bottom_20)

    # 4. Overall portfolio stats (same entry × hold as attribution)
    pts = entry_meta.get("points") or []
    pt = next((p for p in pts if p.get("trading_day") == DEFAULT_HOLD_DAYS), None)
    if not pt:
        print(f"Error: No curve point for entry {DEFAULT_ENTRY}, trading_day={DEFAULT_HOLD_DAYS}")
        return
    total_trades = pt["count"]
    avg_ret = pt["avg_return_pct"]
    win_rate = pt["win_rate"]
    
    # Portfolio Calculation (Assuming 1M KRW per trade)
    pos_size = 1_000_000
    total_invested = total_trades * pos_size
    net_profit = total_invested * (avg_ret / 100)

    # 5. Generate Markdown
    md = f"""# 백테스팅 성과 분석 보고서 (그리드 상위 조합 기준)

## 1. 종합 수익률 요약
- **진입 방식:** {entry_label} (코드 {DEFAULT_ENTRY})
- **보유 기간:** 진입일 기준 **{DEFAULT_HOLD_DAYS}거래일** 보유 후 청산(각 청산일 장중 마지막 5분봉 종가, 곡선 정의와 동일)
- **선정 근거:** `publish_horizon_curve.json` 전 조합 스캔 시 **평균 수익률 상위**이면서 표본 n이 충분한 조합(그리드 1위: E×18일, n≈979)
- **총 시행 횟수:** {total_trades:,} 건
- **평균 수익률:** {avg_ret:+.3f}%
- **승률:** {win_rate*100:.1f}%
- **기대 손익 (100만원 투자 시):** 한 건당 평균 {1_000_000 * (avg_ret/100):+,.0f}원 수익
- **단순 합산 수익 (건당 100만원 가정):** {net_profit:,.0f}원

> **Insight:** 단기 1일 보유(A×1)보다 보유를 늘리고 진입을 T+1 둘째 봉 시가로 잡은 조합이 곡선상 평균 수익·승률이 더 높습니다. 다만 n이 줄고 장기 데이터 의존도가 커지므로 비용·생존 편향을 별도로 고려하세요.

## 2. 왜 올랐나? (상위 수익 종목 분석)
수익률 상위 20개 종목에 공통적으로 나타난 테마입니다.

| 테마 | 빈도 | 비중 |
| :--- | :---: | :---: |
{chr(10).join([f"| {t} | {c} | {c/20*100:.0f}% |" for t, c in win_themes.most_common(5)])}

### 주요 수익 종목 예시
| 종목 | 평균 수익 | 횟수 | 주요 태그 | 대표 기사 제목 |
| :--- | :---: | :---: | :--- | :--- |
{chr(10).join([f"| {d['ticker']} | {d['ret']:+.2f}% | {d['count']} | {', '.join(d['tags'][:2])} | {d['top_title'][:40]}... |" for d in win_details[:10]])}

## 3. 왜 내렸나? (하위 수익 종목 분석)
손실이 컸던 종목들에 주로 나타난 테마입니다.

| 테마 | 빈도 | 비중 |
| :--- | :---: | :---: |
{chr(10).join([f"| {t} | {c} | {c/20*100:.0f}% |" for t, c in loss_themes.most_common(5)])}

### 주요 손실 종목 예시
| 종목 | 평균 수익 | 횟수 | 주요 태그 | 대표 기사 제목 |
| :--- | :---: | :---: | :--- | :--- |
{chr(10).join([f"| {d['ticker']} | {d['ret']:+.2f}% | {d['count']} | {', '.join(d['tags'][:2])} | {d['top_title'][:40]}... |" for d in loss_details[:10]])}

## 4. 핵심 분석 결과
1. **임상 및 기술이전의 양면성:** 수익 상위에서도 '임상' 관련 기사가 많지만, 손실 하위에서도 나타납니다. 즉, 기사 내용의 '구체성'이나 '결과'에 따라 시장 반응이 극명하게 갈립니다.
2. **거래/공시 리스크:** 손실 하위 종목군에서는 '거래·공시' (관리종목, 불성실공시 등) 관련 키워드가 더 자주 포착됩니다. 악재 뉴스는 즉각적인 투매를 부릅니다.
3. **보유 기간:** 본 리포트는 **{DEFAULT_HOLD_DAYS}거래일** 보유 기준 티커 귀속이며, 1일 스캔과 비교하면 중기 재료 반영 비중이 큽니다.

---
*보고서 생성: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""

    with open(OUT_REPORT, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"Report generated: {OUT_REPORT}")

if __name__ == "__main__":
    run_analysis()
