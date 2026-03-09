import json

extra_map = {
    "코오롱티슈진": "950160",
    "바이오솔루션": "086820",
    "유엑스엔": "337840",
    "지놈앤컴퍼니": "314130",
    "에이아이메딕": "비상장",
    "메디픽셀": "비상장",
    "갤럭스": "비상장",
    "히츠": "비상장",
    "로완": "비상장",
    "에이슬립": "비상장",
    "코넥티브": "비상장",
    "인벤테라": "비상장",
    "에이티센스": "비상장",
    "엠투웬티": "비상장",
    "에스디바이오센서": "137310",
    "메리디언": "137310", # SD Biosensor Subsidiary
    "엔솔바이오": "140610",
    "엘앤케이바이오": "156100",
    "큐로셀": "372320",
    "올릭스": "226950",
    "루닛": "328130",
    "뷰노": "338220",
    "코어라인": "384470"
}

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'r') as f:
    data = json.load(f)

for article in data:
    full_text = article.get('title', '') + " " + (article.get('body') or '')
    tickers = set(article.get('tickers', []))
    
    for name, ticker in extra_map.items():
        if name in full_text:
            tickers.add(ticker)
            
    article['tickers'] = sorted(list(tickers))

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print("✅ Final ticker refinement including research partner companies complete.")
