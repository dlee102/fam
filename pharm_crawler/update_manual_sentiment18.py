import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "디티앤씨알오, 올해 실적 반등 자신하는 이유": {"score": 75, "label": "positive", "reasoning": "비임상·임상 수주 증가 및 국내 유일 GLP 인증 센터 가동으로 실적 개선 가시화"},
    "허가 전 판권 계약으로 글로벌 시장 선점 가속화": {"score": 85, "label": "positive", "reasoning": "상용화 전 단계에서의 글로벌 판권 계약(입도선매)을 통한 국산 신약의 데이터 신뢰도 입증"},
    "듀켐바이오, 신약 상반기 공개…“12兆 삼중음성유방암": {"score": 80, "label": "positive", "reasoning": "상반기 중 방사성의약품(RPT) 신약 파이프라인 공개 예정 및 타겟 시장 규모 기대감"},
    "위고비·마운자로' 비만약 유통 효과 누린 블루엠텍": {"score": 80, "label": "positive", "reasoning": "글로벌 비만약 유통 효과 및 온라인 플랫폼의 강점을 활용한 에스테틱 확장 전략 주효"},
    "약 한번 맞아보고 죽고 싶다”…젬백스, GV1001 조건부 허가": {"score": 70, "label": "positive", "reasoning": "희귀 질환인 PSP 치료제 조건부 허가 신청을 통한 상용화 시도 및 절박한 환자 수요 확인"},
    "카나브 만들었지만 시장 못 만들었다'… 알리코제약": {"score": 35, "label": "negative", "reasoning": "주요 도입 품목의 시장 안착 실패 및 수익성 저하 우려"},
    "Hyundai Bio·Hyundai ADM Hit Upper Limit": {"score": 90, "label": "positive", "reasoning": "임상 가속화 소식에 따른 현대바이오 그룹주의 동반 상한가 기록"},
    "수퍼폰탄 뺐더니 달라졌다\"... 메지온 FUEL-2": {"score": 85, "label": "positive", "reasoning": "임상 설계 최적화(수퍼폰탄 제외)를 통한 유효성 입증 가능성 증대 및 데이터 신뢰도 확보"},
    "뉴로핏, FDA 추가 허가 임박": {"score": 80, "label": "positive", "reasoning": "글로벌 빅파마와의 협업 및 뇌질환 진단 솔루션의 FDA 허가 임박에 따른 가치 재평가"},
    "지투지바이오에 기관투자자 1500억 베팅": {"score": 85, "label": "positive", "reasoning": "차세대 약물 전달 기술력을 높게 평가받아 대규모 기관 자금 유치 성공"}
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
