import json
import re

drug_to_listed = {
    "렉라자": "000100",        # Yuhan
    "헴리브라": "001060",      # JW Pharm
    "키트루다": "196170",      # Alteogen (SC Technology / Partner)
    "리보세라닙": "028300",    # HLB
    "캄렐리주맙": "028300",    # HLB Partner
    "에페글레나타이드": "128940", # Hanmi
    "롤론티스": "128940",      # Hanmi
    "카나브": "003850",        # Boryung
    "제미글로": "051900",      # LG Chem (LG Life Science)
    "카이졸": "308430",        # Cellbion
    "림카토": "372320",        # Curocell
    "안발셀": "372320",        # Curocell
    "바벤시오": "196170"       # Alteogen etc.
}

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'r') as f:
    data = json.load(f)

updated_count = 0
for article in data:
    full_text = article.get('title', '') + " " + (article.get('body') or '')
    tickers = set(article.get('tickers', []))
    
    for drug, ticker in drug_to_listed.items():
        if drug in full_text:
            tickers.add(ticker)
            
    new_tickers_list = sorted(list(tickers))
    if new_tickers_list != article.get('tickers'):
        article['tickers'] = new_tickers_list
        updated_count += 1

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print(f"✅ Drug name mapping complete: Updated {updated_count} articles.")
