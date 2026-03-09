import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "이경열 쓰리빌리언 CSO \"AI로 신약 후보물질 5종 발굴": {"score": 80, "label": "positive", "reasoning": "AI 기술을 활용한 신약 발굴 성과 및 빅파마와의 공동 연구 본격화로 인한 체질 개선 성공"},
    "이슬기 디앤디파마텍 대표 \"경구약시장 개화 시작, 상반기 MASH신약 기술 이전": {"score": 85, "label": "positive", "reasoning": "경구용 비만·MASH 치료제의 시장 수요 급증 및 상반기 내 대규모 기술 이전 추진"},
    "박용근 토모큐브 대표 “올해 오가노이드 분석 제품·의료기기 출시": {"score": 75, "label": "positive", "reasoning": "장비 판매에서 구독 모델로의 수익 구조 고도화 및 흑자 전환 가시화"},
    "액체생검 그레일 ‘쇼크’...GC지놈·아이엠비디엑스": {"score": 60, "label": "neutral", "reasoning": "그레일의 임상 실패로 시장이 요동치고 있으나 국내 기업들은 이를 기회로 활용하겠다는 전략"},
    "2% Royalty Shock at Alteogen Ripples Through Korean Biotech": {"score": 30, "label": "negative", "reasoning": "안테오젠 로열티 쇼크로 인한 섹터 전반의 투자 심리 위축 및 지수 하락"},
    "CellBioN, Quracle Spark Commercialization Hopes": {"score": 80, "label": "positive", "reasoning": "셀비온과 큐라클의 상용화 기대감이 섹터 전체의 센티먼트를 지지"},
    "곡면 밀착·고해상도 신호 등 독보적인 BCI기술 보유": {"score": 80, "label": "positive", "reasoning": "한국형 뉴럴링크를 지향하는 독보적인 BCI 기술력과 확장성 부각"},
    "문여정 IMM인베스트먼트 전무 \"ADC·DDS·CNS 주목": {"score": 70, "label": "positive", "reasoning": "전문 VC의 시각에서 본 차기 주도 섹터(ADC, DDS 등)에 대한 긍정적 전망"},
    "AprilBio Falls on Insider Sales...Cellbion, NEUROPHET Up": {"score": 60, "label": "neutral", "reasoning": "임원 매도 등 개별 악재와 임상 호재가 공존하는 종목별 차별화 장세"},
    "김경민 용인세브란스 교수 \"GLP-1 비만약, 복합제보다 투약 주기 관건": {"score": 75, "label": "positive", "reasoning": "비만약 시장에서의 편의성 중요성 부각 및 관련 기술 보유 기업의 가치 제고"}
}

matched_count = 0
for article in articles:
    title = article.get('title', '')
    if title:
        for key, val in analysis_results.items():
            if key in title or title in key:
                article['sentiment_score'] = val['score']
                article['sentiment_label'] = val['label']
                article['gemini_reasoning'] = val['reasoning']
                matched_count += 1
                break

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(articles, f, ensure_ascii=False, indent=4)

print(f"✅ Updated {matched_count} results.")
