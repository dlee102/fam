import json
import re

def parse_datetime(date_str):
    if not date_str:
        return None, None
    
    # 1. Korean format: 등록 2026-01-12 오전 8:20:03
    ko_match = re.search(r'(\d{4})-(\d{2})-(\d{2})\s+(오전|오후)\s+(\d{1,2}):(\d{2})', date_str)
    if ko_match:
        y, m, d, am_pm, hr, mn = ko_match.groups()
        hr = int(hr)
        if am_pm == '오후' and hr < 12:
            hr += 12
        elif am_pm == '오전' and hr == 12:
            hr = 0
        return f"{y}-{m}-{d}", f"{hr:02d}:{mn}"

    # 2. English format: created on 01/12/2026 8:10:03 AM
    en_match = re.search(r'(\d{2})/(\d{2})/(\d{4})\s+(\d{1,2}):(\d{2}):\d{2}\s+(AM|PM)', date_str)
    if en_match:
        m, d, y, hr, mn, am_pm = en_match.groups()
        hr = int(hr)
        if am_pm == 'PM' and hr < 12:
            hr += 12
        elif am_pm == 'AM' and hr == 12:
            hr = 0
        return f"{y}-{m}-{d}", f"{hr:02d}:{mn}"
    
    # Fallback to just date if time not found
    date_only = re.search(r'(\d{4})[./-]?(\d{2})[./-]?(\d{2})', date_str)
    if date_only:
        return f"{date_only.group(1)}-{date_only.group(2)}-{date_only.group(3)}", "00:00"

    return "2026-01-01", "00:00"

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'r') as f:
    data = json.load(f)

for article in data:
    raw_date = article.get('date', '')
    p_date, p_time = parse_datetime(raw_date)
    article['published_date'] = p_date
    article['published_time'] = p_time

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print("✅ Extracted date and time for all articles.")
