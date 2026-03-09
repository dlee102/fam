import json
import re

ticker_map = {
    "바이젠셀": "308080", "VigenCell": "308080",
    "파마리서치": "214450", "PharmaResearch": "214450",
    "한미그룹": "008930",
    "한미사이언스": "008930",
    "한미약품": "128940",
}

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'r') as f:
    data = json.load(f)

count = 0
for article in data:
    title = article.get('title', '')
    body = article.get('body', '') or ''
    
    current_tickers = article.get('tickers', []) or []
    found = set(current_tickers)
    
    for name, ticker in ticker_map.items():
        if name in title or name in body:
            found.add(ticker)
            
    new_tickers = sorted(list(found))
    if new_tickers != current_tickers:
        article['tickers'] = new_tickers
        count += 1

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print(f"✅ Final polish: Updated {count} articles.")
