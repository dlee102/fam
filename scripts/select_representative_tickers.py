import json
from pathlib import Path

# Paths
BASE = Path(__file__).resolve().parent.parent
NEWS_PATH = BASE / "data" / "news_tickers.json"
TICKER_NAMES_PATH = BASE / "data" / "ticker_names.json"

# Manual mapping for common foreign tickers/aliases found in pharmaceutical news
ADDITIONAL_MAPPINGS = {
    "LLY": "일라이릴리",
    "ROG": "로슈",
    "MRK": "머크",
    "SNY": "사노피",
    "GSK": "GSK",
    "AZN": "아스트라제네카",
    "NVO": "노보노디스크",
    "PFE": "화이자",
    "BMY": "BMS",
    "ABBV": "애브비",
    "AMGN": "암젠",
    "GILD": "길리어드",
    "VRTX": "버텍스",
    "REGN": "리제네론",
    "비상장": "비상장",
    "코스닥": "코스닥",
    "유가": "유가",
}

def load_data():
    with open(NEWS_PATH, encoding="utf-8") as f:
        news_data = json.load(f)
    with open(TICKER_NAMES_PATH, encoding="utf-8") as f:
        ticker_names = json.load(f)
    return news_data, ticker_names

def select_representative(article, ticker_names):
    title = article.get("title", "")
    tickers = article.get("tickers", [])
    
    if not tickers:
        return []

    candidates = []
    for ticker in tickers:
        name = ticker_names.get(ticker) or ADDITIONAL_MAPPINGS.get(ticker, ticker)
        # Check if name is in title
        # Also check for aliases if possible, but let's stick to name for now.
        in_title = name in title
        
        # Heuristic: If name is partially in title (e.g., "삼성전자" in title "삼성전기") 
        # but let's be strict first. 
        # Some ticker names might be short (e.g. "대웅"). 
        
        candidates.append({
            "ticker": ticker,
            "name": name,
            "in_title": in_title
        })
    
    # Sort: in_title first, then original order
    # Using original order as secondary sort because often the first ticker in the list is the main one
    sorted_candidates = sorted(candidates, key=lambda x: x["in_title"], reverse=True)
    
    # Pick top 2 if many are in title, otherwise pick 1 if only one or original order
    results = []
    
    # If any in title, pick them (up to 2)
    in_title_candidates = [c["ticker"] for c in sorted_candidates if c["in_title"]]
    if in_title_candidates:
        results = in_title_candidates[:2]
    else:
        # None in title, pick the first 1-2 from original list
        results = tickers[:2]
        
    return results

def main():
    news_data, ticker_names = load_data()
    
    updated_articles = []
    for article in news_data["articles"]:
        representative = select_representative(article, ticker_names)
        # We'll update the 'tickers' field directly or add a new one?
        # The user said "새롭게 지정해줘" (newly specify).
        # Usually it's better to update the 'tickers' field if they want to reduce the noise.
        # But let's keep the original and add a new field to be safe, then maybe replace it.
        # Actually, let's just replace 'tickers' with the representative ones as requested.
        article["original_tickers"] = article["tickers"]
        article["tickers"] = representative
        updated_articles.append(article)
    
    news_data["articles"] = updated_articles
    
    # Save the updated data
    with open(NEWS_PATH, "w", encoding="utf-8") as f:
        json.dump(news_data, f, ensure_ascii=False, indent=2)
    
    print(f"Updated {len(updated_articles)} articles with representative tickers.")

if __name__ == "__main__":
    main()
