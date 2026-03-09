import json
from collections import Counter

def audit_data():
    file_path = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    total = len(data)
    analyzed = [a for a in data if a.get('sentiment_score') != 50 or a.get('gemini_reasoning') != '분석 미진행 (기본값)']
    missing_date = [a for a in data if not a.get('published_date')]
    missing_tickers = [a for a in data if not a.get('tickers')]
    
    print(f"--- [Data Audit Report] ---")
    print(f"Total Articles: {total}")
    print(f"Fully Analyzed: {len(analyzed)} ({len(analyzed)/total*100:.1f}%)")
    print(f"Missing Date: {len(missing_date)}")
    print(f"Missing Tickers: {len(missing_tickers)}")
    
    label_counts = Counter([a.get('sentiment_label', 'N/A') for a in data])
    print(f"\nSentiment Distribution: {dict(label_counts)}")
    
    # Check for scores that might be stuck at default 50
    default_50s = [a['title'] for a in data if a.get('sentiment_score') == 50 and a.get('gemini_reasoning') == '분석 미진행 (기본값)']
    if default_50s:
        print(f"\nRemaining 'Default' Articles ({len(default_50s)}):")
        for title in default_50s[:10]:
            print(f"- {title}")
        if len(default_50s) > 10:
            print(f"... and {len(default_50s)-10} more.")
    else:
        print(f"\n✅ All articles have been custom scored and reasoned.")

    # Check date distribution
    date_counts = Counter([a.get('published_date', 'N/A') for a in data])
    print(f"\nTop Dates: {dict(date_counts.most_common(5))}")

if __name__ == '__main__':
    audit_data()
