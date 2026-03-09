import json

final_updates = {
    58: ["비상장"],
    85: ["K-Bio"], # Industry
    131: ["Platform"],
    169: ["비상장"],
    205: ["비상장"]
}

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'r') as f:
    data = json.load(f)

for idx, tkrs in final_updates.items():
    if idx < len(data):
        data[idx]['tickers'] = sorted(list(set(data[idx].get('tickers', []) + tkrs)))

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print("✅ Final ticker manual fix for remaining articles.")
