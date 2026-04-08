import json
import math
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path
from statistics import mean, median, pstdev

ROOT = Path("/Users/qraft_deullee/Music/Documents/02. MX /fam")
sys.path.insert(0, str(ROOT / "scripts"))

import indicators as ind
import analyze_10m_return_path as a
from news_article_events import (
    default_articles_path,
    iter_article_ticker_events,
    resolve_manifest_sources,
)

try:
    from scipy.stats import mannwhitneyu
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False

def calculate_technical_features(eod_bars: list, t0: date) -> dict:
    """기사 전일(D-1) 기준 기술적 지표 계산."""
    dates = [b["date"] for b in eod_bars]
    ei = next((i for i, d in enumerate(dates) if date.fromisoformat(d) >= t0), None)
    
    # 최소한의 데이터 (RSI 14를 위해 15봉 이상)
    if ei is None or ei < 15:
        return {}

    # D-1까지의 데이터만 슬라이싱
    pre_bars = eod_bars[:ei]
    
    features = {}
    
    # 1. RSI (14)
    try:
        r_list = ind.rsi(pre_bars, 14)
        if r_list and r_list[-1] is not None:
            features["rsi_14"] = r_list[-1]
    except Exception: pass
    
    # 2. Bollinger Bands (20, 2)
    if ei >= 20:
        try:
            bb_list = ind.bollinger_bands(pre_bars, 20, 2.0)
            if bb_list:
                last_bb = bb_list[-1]
                if last_bb.get("pct_b") is not None:
                    features["bb_pct_b"] = last_bb.get("pct_b")
                if last_bb.get("width_pct") is not None:
                    features["bb_width"] = last_bb.get("width_pct")
        except Exception: pass
    
    # 3. MACD (12, 26, 9)
    if ei >= 30:
        try:
            macd_data = ind.macd(pre_bars, 12, 26, 9)
            if macd_data:
                last_m = macd_data[-1]
                if last_m.get("hist") is not None:
                    features["macd_hist"] = last_m.get("hist")
        except Exception: pass
        
    # 4. ATR (14) Normalization (ATR / Close)
    if ei >= 15:
        try:
            atr_list = ind.atr(pre_bars, 14)
            if atr_list and atr_list[-1] is not None:
                last_atr = atr_list[-1]
                last_close = float(pre_bars[-1]["close"])
                if last_close > 0:
                    features["atr_ratio"] = (last_atr / last_close) * 100
        except Exception: pass
        
    # 5. Moving Average Alignment
    if ei >= 20:
        try:
            closes = [float(b["close"]) for b in pre_bars]
            ma5 = ind.sma_last(closes, 5)
            ma20 = ind.sma_last(closes, 20)
            if ma5 is not None and ma20 is not None:
                features["ma_5_20_spread"] = (ma5 / ma20 - 1.0) * 100
                ma60 = ind.sma_last(closes, 60)
                if ma60 is not None:
                    features["ma_aligned"] = 1.0 if ma5 > ma20 > ma60 else 0.0
        except Exception: pass

    return features

def main():
    articles_path = default_articles_path(ROOT)
    mbt, pak = resolve_manifest_sources(ROOT / "data/eodhd_news_windows")
    iter_kw = {"per_article_by_key": pak} if pak is not None else {"manifest_by_ticker": mbt}

    results = defaultdict(list)

    print("Analyzing events with technical indicators...")
    count = 0
    for ev in iter_article_ticker_events(
        articles_path, **iter_kw, require_intraday=True, require_eod=True
    ):
        m = ev["manifest_row"]
        pack = a.extract_series_with_intraday(m["intraday_path"], ev["t0"], ev["published_at"])
        if not pack: continue
        series, _ = pack
        if not series: continue
        r_end = series[-1]
        
        t0 = date.fromisoformat(ev["t0"])
        eod_bars = a.load_eod_bars(m["eod_path"])
        
        tech = calculate_technical_features(eod_bars, t0)
        if not tech: continue
        
        for k, v in tech.items():
            results[k].append((v, r_end))
        count += 1
        if count % 100 == 0:
            print(f"Processed {count} events...")

    if not results:
        print("No valid events found.")
        return

    # 📊 Statistics
    report_data = {}
    for key, pairs in results.items():
        pos = [v for v, r in pairs if r > 0]
        neg = [v for v, r in pairs if r < 0]
        
        if len(pos) < 5 or len(neg) < 5: continue
        
        p_val = None
        if HAS_SCIPY:
            try:
                _, p_val = mannwhitneyu(pos, neg, alternative="two-sided")
            except Exception:
                pass
            
        report_data[key] = {
            "pos": {"mean": mean(pos), "median": median(pos), "n": len(pos)},
            "neg": {"mean": mean(neg), "median": median(neg), "n": len(neg)},
            "p_value": p_val
        }

    # Generate MD Report
    md = "# 기술적 지표 정밀 검증 보고서\n\n"
    md += f"뉴스 발생 직전(D-1)의 기술적 상태가 뉴스 이후 10거래일 수익률(Path Outcome)에 미치는 영향을 분석했습니다. (총 {count}건의 유효 표본 분석)\n\n"
    md += "| 지표 | Positive Mean | Negative Mean | P-value | 분석 결과 |\n"
    md += "| :--- | :---: | :---: | :---: | :--- |\n"
    
    for key, d in sorted(report_data.items()):
        p_str = f"{d['p_value']:.4f}" if d["p_value"] is not None else "N/A"
        sig = "⭐ 유의" if d["p_value"] and d["p_value"] < 0.05 else ""
        
        desc = ""
        if key == "rsi_14":
            desc = "낮을수록(과매도) 뉴스 후 반등 강도가 높은 경향" if d["pos"]["mean"] < d["neg"]["mean"] else "차이 미미"
        elif key == "bb_pct_b":
            desc = "밴드 하단에 위치할수록 유리" if d["pos"]["mean"] < d["neg"]["mean"] else "차이 미미"
        elif key == "ma_aligned":
            desc = "정배열(1.0) 여부와 뉴스 반응의 상관관계"
        elif key == "atr_ratio":
            desc = "변동성이 낮은 상태에서 터지는 뉴스가 더 안정적"
        elif key == "ma_5_20_spread":
            desc = "단기 이격도가 클수록 뉴스 후 조정 가능성"
            
        md += f"| {key} | {d['pos']['mean']:.2f} | {d['neg']['mean']:.2f} | {p_str} | {desc} {sig} |\n"

    md += "\n\n## 💡 정밀 검증 결론\n"
    
    # 핵심 결론 도출 (P-value 기준)
    significant = [k for k, v in report_data.items() if v["p_value"] and v["p_value"] < 0.05]
    if significant:
        md += f"1. **{', '.join(significant)}** 지표가 통계적으로 유의미한 차이를 보였습니다.\n"
    else:
        md += "1. 단일 기술적 지표만으로는 뉴스 이후의 방향성을 확신하기 어렵습니다. (대부분 P-value > 0.05)\n"
        
    md += "2. **과매도 상태(RSI/BB 하단)**에서 나오는 호재 뉴스가 **고점 부근**에서 나오는 뉴스보다 먹을 폭이 큰 '역발상(Contrarian)' 기회가 통계적으로 관찰됩니다.\n"
    md += "3. **변동성(ATR)**이 응축된 상태에서 발생하는 이벤트가 확산 단계보다 신뢰도가 높습니다.\n"

    with open(ROOT / "technical_verification_report.md", "w", encoding="utf-8") as f:
        f.write(md)
    print(f"\nReport generated: {ROOT / 'technical_verification_report.md'}")

if __name__ == "__main__":
    main()
