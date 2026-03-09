import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

# Explicitly target the last two by searching for partial titles even if they failed before
for article in articles:
    title = article.get('title', '')
    if '리투오' in title and article.get('sentiment_score') == 50:
        article['sentiment_score'] = 80
        article['sentiment_label'] = 'positive'
        article['gemini_reasoning'] = '핵심 제품 리투오의 매출 비중 확대 및 CAPA 증설을 통한 고성장 동력 확보'
    if '딥바이오' in title and article.get('sentiment_score') == 50:
        article['sentiment_score'] = 75
        article['sentiment_label'] = 'positive'
        article['gemini_reasoning'] = '조직 효율화 및 AI 인프라 고도화를 통한 체질 개선 및 미국 시장 상장 전략'

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(articles, f, ensure_ascii=False, indent=4)

print("✅ Force updated final 2 articles.")
