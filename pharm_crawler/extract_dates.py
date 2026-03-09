import json
import re

def parse_published_date(date_str):
    if not date_str:
        return None
    
    # Look for standard YYYY-MM-DD
    match = re.search(r'(\d{4}-\d{2}-\d{2})', date_str)
    if match:
        return match.group(1)
    
    # Look for MM/DD/YYYY format (used in English articles)
    match2 = re.search(r'(\d{2})/(\d{2})/(\d{4})', date_str)
    if match2:
        return f"{match2.group(3)}-{match2.group(1)}-{match2.group(2)}"
        
    return None

def main():
    file_path = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    for article in data:
        date_str = article.get('date', '')
        parsed_date = parse_published_date(date_str)
        article['published_date'] = parsed_date

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
        
    print(f"Successfully extracted publication dates ('published_date') for {len(data)} articles.")

if __name__ == '__main__':
    main()
