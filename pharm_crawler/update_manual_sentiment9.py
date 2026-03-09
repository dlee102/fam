import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "ABL Bio Slides on Sanofi Reprioritization": {"score": 30, "label": "negative", "reasoning": "사노피의 파이프라인 후순위 조정으로 인한 대형 악재 및 20% 급락"},
    "에이프릴바이오, 올해 임상통해 플랫폼가치": {"score": 75, "label": "positive", "reasoning": "다수 임상 결과 발표 예정에 따른 플랫폼 저평가 해소 기대"},
    "아이센스, CGM ‘유럽’ 기대에 23%↑…파미셀, 호실적에 상승": {"score": 85, "label": "positive", "reasoning": "연속혈당측정기 유럽 진출 및 파미셀 어닝 서프라이즈 동반 상승"},
    "JW중외제약 헴리브라, ‘피 멎는 약’이 아니다": {"score": 80, "label": "positive", "reasoning": "A형 혈우병 치료 혁명으로 평가받는 헴리브라의 압도적 유효성 입증"},
    "LIVSMED soars to limit up": {"score": 85, "label": "positive", "reasoning": "코스닥 1000 돌파 장세 속 리브스메드 상한가 안착"},
    "디앤디파마텍, 대사이상지방간염 신약 기술 이전 시나리오": {"score": 80, "label": "positive", "reasoning": "MASH 치료제 2상 결과 임박에 따른 대규모 기술 이전 기대감"},
    "한스바이오메드, 日 스킨부스터 판 흔든다": {"score": 80, "label": "positive", "reasoning": "일본 유통사와 독점 공급 계약 체결로 800억 시장 공략 가시화"},
    "임선민 연세암병원 교수 \"렉라자 6주 투약 데이터": {"score": 75, "label": "positive", "reasoning": "렉라자의 유연한 치료 전략 기반 마련 및 임상 신뢰도 제고"},
    "광동제약 이틀째 상한가 이끈 유베지": {"score": 90, "label": "positive", "reasoning": "노안치료제 FDA 승인 파급력 지속 및 이틀 연속 상한가 달성"},
    "투심 중위험·고수익 기대주로 이동...삼양바이오팜·유투바이오 ↑": {"score": 75, "label": "positive", "reasoning": "실적 기반 우량주로의 자금 이동 및 유투바이오 등 강세"},
    "Jeil Bio’s 29,000% Jump an Illusion": {"score": 20, "label": "negative", "reasoning": "상장 폐지 전 착시 현상에 기인한 급등으로 투자 주의 필요"},
    "스카이랩스, 높아진 거래소 문턱 넘을까": {"score": 60, "label": "neutral", "reasoning": "상장 심사 강화 기조 속 상장 가능성 타진 (중립적)"}
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
