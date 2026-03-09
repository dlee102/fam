import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "K바이오, '입도선매'로 가치 입증": {"score": 85, "label": "positive", "reasoning": "비상업화 전 단계에서의 판권 계약(입도선매) 급증으로 국산 신약의 기술적 경쟁력 입증"},
    "엘앤씨바이오, '리투오'에 힘 싣는다": {"score": 80, "label": "positive", "reasoning": "핵심 신제품 리투오의 폭발적 매출 비중 확대 및 생산 능력 증설로 고성장 가시화"},
    "김선우 딥바이오 대표 \"300개 GPU가 대신한다\"": {"score": 75, "label": "positive", "reasoning": "조직 효율화 및 AI 인프라 고도화를 통한 체질 개선 및 미국 시장 상장 전략"},
    "빗장 풀린 제약바이오 이사회… '몰빵 투표' 공포": {"score": 60, "label": "neutral", "reasoning": "지배구조 강화(이사 선임 정책 등)에 따른 경영권 안정 노력 및 투명성 제고 시기"},
    "中우시 '945개 美프로젝트', K바이오의 기회": {"score": 85, "label": "positive", "reasoning": "미국 생물보안법 수혜로 인한 중국 우시의 글로벌 물량 흡수 및 CDMO 반사이익 기대"},
    "메쥬, 내년 흑전 자신…'텐배거' 씨어스 사례 재현할까": {"score": 75, "label": "positive", "reasoning": "보험 수가 적용 및 공격적인 국내 병원 침투로 인한 턴어라운드 기대"},
    "바이젠셀, 임상 2상 결과 핵심 포인트는…조건부 허가 가능할까": {"score": 70, "label": "positive", "reasoning": "임상 2상 완료에 따른 데이터 분석 및 조건부 품목 허가 신청 가능성 부각"},
    "파인메딕스, 내시경용 지혈 시술기구 日하반기 허가": {"score": 75, "label": "positive", "reasoning": "내시경 지혈 시술기구의 일본 의료기기 허가 획득 및 해외 매출 본격화 기대"},
    "루닛·뷰노·코어라인 상장 후 지속된 시장조달": {"score": 60, "label": "neutral", "reasoning": "금융 시장 조달을 통한 R&D 자금 확보 및 자생력 확보를 위한 고군분투 지속"},
    "투자자가 묻다...머크와 협력 진행 상황은?": {"score": 80, "label": "positive", "reasoning": "글로벌 빅파마 머크와의 병용 임상 순항 및 공동 연구 신뢰도 확인"},
    "134억 프리IPO 완료, '연내 상장 도전' 에이티센스": {"score": 80, "label": "positive", "reasoning": "프리IPO 자금 유치 성공 및 연내 코스닥 상장 목표를 통한 성장 동력 확보"}
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

print(f"✅ Updated {matched_count} final results.")
