import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "라파스, 마이크로니들 비만 패치 반감기": {"score": 80, "label": "positive", "reasoning": "마이크로니들 비만 패치의 긴 반감기와 높은 생체이용률 확인으로 차세대 제형 경쟁력 입증"},
    "디시젠, 내달 ‘상장 관문’ 기평 돌입": {"score": 70, "label": "positive", "reasoning": "실적 기반 기술성 평가 진입 및 연내 상장 목표 가시화"},
    "'체질 개선 완료' SD바이오센서, 실적 반등위한 비장의 카드": {"score": 75, "label": "positive", "reasoning": "비코로나 제품 체질 개선 완료 및 미국/인도 시장 본격 공략을 통한 턴어라운드 기대"},
    "‘日정형외과 강자’ 테이코쿠 손잡은 메디포스트": {"score": 85, "label": "positive", "reasoning": "일본 정형외과 강사와의 판권 계약으로 수천억대 해외 매출 기반 확보"},
    "어려운 배달도 척척…약물전달 플랫폼이 뜬다": {"score": 75, "label": "positive", "reasoning": "약물 전달 플랫폼(DDS) 기술의 확장성과 상업적 가치 주목"},
    "AAV 황반변성치료제 기술 이전 추진": {"score": 80, "label": "positive", "reasoning": "글로벌 수조원대 딜 사례가 있는 AAV 기반 치료제 기술 이전 추진 및 상장 준비"},
    "알테오젠 충격 속…로슈와 두 자릿수 로열티 바이오다인 재평가": {"score": 85, "label": "positive", "reasoning": "알테오젠 로열티 논란 속 두 자릿수 로열티를 확보한 바이오다인의 독보적 수익 구조 부각"},
    "무릎·척추·고관절·족부 등 정밀 계측 AI 소프트웨어 연이어 출시": {"score": 75, "label": "positive", "reasoning": "AI 영상 진단 부위 확대 및 수술 로봇 상용화를 통한 성장 가속"},
    "출시 2년 만에 점유율 7.5%'…아이센스": {"score": 80, "label": "positive", "reasoning": "국산 CGM의 성공적 시장 안착 및 지속 가능한 성장 엔진 확보"},
    "오스코텍 항내성 항암제, 조 단위 ‘빅 딜’ 기대": {"score": 85, "label": "positive", "reasoning": "근본적 내성 억제 기전 확보 및 조 단위 기술 수출 기대감 고조"},
    "'실적 슈퍼사이클 진입'…디오, 영업이익 3배 폭증": {"score": 85, "label": "positive", "reasoning": "중국 매출 급증 및 빅배스 완료에 따른 레버리지 구간 진입으로 이익 폭증 예고"},
    "한미사이언스 ‘경영권 충돌’에 급등...현대ADM·바이오톡스텍도 ↑": {"score": 80, "label": "positive", "reasoning": "경영권 분쟁에 따른 지분 경쟁 및 개별 신약 성과에 따른 섹터 동반 강세"}
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
