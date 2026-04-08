import json
from collections import Counter
from datetime import datetime
from pathlib import Path

def generate_stats():
    # File paths
    article_tickers_path = Path("data/somedaynews_article_tickers.json")
    themes_path = Path("data/analysis/publish_5d_article_themes.json")
    
    if not article_tickers_path.exists():
        print(f"Error: {article_tickers_path} not found.")
        return

    # 1. Load article_tickers data
    with open(article_tickers_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    # Handle duplicates by (article_id, ticker)
    unique_pairs = set()
    unique_articles = {} # article_id -> title
    ticker_counter = Counter()
    dates = []
    
    for item in data:
        article_id = item.get("article_id")
        title = item.get("title")
        stock_codes = item.get("stock_codes", [])
        published_at = item.get("published_at")
        
        if article_id and published_at:
            unique_articles[article_id] = title
            try:
                # published_at: 2025-01-02T07:30:39+09:00
                dt = datetime.fromisoformat(published_at)
                dates.append(dt)
            except ValueError:
                pass
            
            for code in stock_codes:
                pair = (article_id, code)
                if pair not in unique_pairs:
                    unique_pairs.add(pair)
                    ticker_counter[code] += 1

    # 2. Basic Stats
    total_records = len(data)
    num_unique_articles = len(unique_articles)
    num_unique_tickers = len(ticker_counter)
    avg_tickers_per_article = len(unique_pairs) / num_unique_articles if num_unique_articles > 0 else 0
    
    start_date = min(dates) if dates else "N/A"
    end_date = max(dates) if dates else "N/A"
    
    top_10_tickers = ticker_counter.most_common(10)
    
    # 3. Load Theme Stats (if available)
    theme_stats = None
    if themes_path.exists():
        with open(themes_path, "r", encoding="utf-8") as f:
            theme_data = json.load(f)
            theme_stats = theme_data.get("tag_counts_article_level", {})

    # 4. Generate Markdown
    md_content = f"""# 기사-종목 기본 통계 보고서

## 1. 데이터 개요
- **기준 파일:** `{article_tickers_path}`
- **전체 레코드 수:** {total_records:,} 건 (중복 포함)
- **고유 기사 수:** {num_unique_articles:,} 건
- **고유 종목 수:** {num_unique_tickers:,} 종목
- **분석 기간:** {start_date.strftime('%Y-%m-%d') if isinstance(start_date, datetime) else start_date} ~ {end_date.strftime('%Y-%m-%d') if isinstance(end_date, datetime) else end_date}
- **기사당 평균 노출 종목:** {avg_tickers_per_article:.2f} 개

## 2. 종목별 노출 빈도 (상위 10개)
| 순위 | 종목 코드 | 기사 노출 횟수 |
| :--- | :--- | :--- |
{chr(10).join([f"| {i+1} | {code} | {count} |" for i, (code, count) in enumerate(top_10_tickers)])}

"""
    if theme_stats:
        top_themes = sorted(theme_stats.items(), key=lambda x: x[1], reverse=True)[:10]
        md_content += """## 3. 기사 테마/분류 통계 (상위 10개)
*출처: `publish_5d_article_themes.json`*

| 순위 | 테마 분류 | 기사 수 |
| :--- | :--- | :--- |
"""
        md_content += "\n".join([f"| {i+1} | {tag} | {count} |" for i, (tag, count) in enumerate(top_themes)])
        md_content += "\n"

    md_content += f"""
---
*보고서 생성 일시: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""

    with open("article_ticker_stats.md", "w", encoding="utf-8") as f:
        f.write(md_content)
    
    print("article_ticker_stats.md 생성 완료")

if __name__ == "__main__":
    generate_stats()
