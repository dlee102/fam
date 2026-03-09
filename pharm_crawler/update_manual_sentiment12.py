import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "라파스, 마이크로니들 비만패치 SC제형 반감기 넘었다": {"score": 85, "label": "positive", "reasoning": "기존 주사제보다 긴 반감기를 입증하며 기술 수출 가치 및 편의성 대폭 상승"},
    "엑셀세라퓨틱스, 대만發 호재에 상한가 직행": {"score": 90, "label": "positive", "reasoning": "세포유전자치료제 전용 배지 기술력과 대만 시장 진출 호재로 상한가 기록"},
    "임플란트계 TSMC 꿈꾼다'…시지메드텍": {"score": 80, "label": "positive", "reasoning": "치과 임플란트 CDMO 비즈니스 모델 본격 가동 및 신공장 가동을 통한 실적 폭주 기대"},
    "김남용 큐리옥스 대표 \"日 대리점 첫 판매 계약": {"score": 85, "label": "positive", "reasoning": "글로벌 톱10 기업과의 전사 표준 계약 논의 및 일본 시장 안착으로 퀀텀점프 원년 선언"},
    "오버행 해소 리브스메드 상한가…'상폐' 파멥신": {"score": 50, "label": "neutral", "reasoning": "오버행 해소에 따른 상한가와 상장폐지라는 극단적 명암 교차"},
    "기술 하나로 판 키운다…토모큐브·스페클립스 전략": {"score": 80, "label": "positive", "reasoning": "3D 세포 분석 기술 등 독보적 원천 기술을 바탕으로 한 플랫폼 확장성 부각"},
    "씨어스테크놀로지보다 우월하다는 메디아나": {"score": 60, "label": "neutral", "reasoning": "환자 모니터링 시장 내 경쟁 심화 및 기업 간 비교 논란 (중립적)"},
    "김현기 스톤브릿지벤처스 상무 \"아델·인제니아·넥스아이 상장 기대": {"score": 75, "label": "positive", "reasoning": "탄탄한 기술력을 가진 포트폴리오 기업들의 상장 기대감 및 VC 자금 유입"},
    "위고비가 흔든 MASH 판…디앤디·한미약품엔 기회일까 위기일까": {"score": 70, "label": "positive", "reasoning": "경구용 비만약 열풍이 MASH 치료제 시장에도 긍정적인 촉매제가 될 것이라는 분석"},
    "스타라타 ‘상장폐지’에 힘빠진 소송, 레이저옵텍 美시장 재도약": {"score": 75, "label": "positive", "reasoning": "경쟁사 상장 폐지로 인한 소송 리스크 소멸 및 미국 시장 점유율 확대 기회 포착"}
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
