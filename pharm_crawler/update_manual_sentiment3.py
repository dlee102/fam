import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

results_map = {
    "ABL바이오, 사노피 변수에 20만원선 붕괴…HLB·루닛도 악재 부각[바이오맥짚기]": {"score": 30, "label": "negative", "reasoning": "사노피의 개발 우선순위 조정이라는 대형 악재 및 제약바이오 투심 위축"},
    "\"올해 비만약 이어 에스테틱 유통 확대로 매출 첫 2000억·흑자 전환 예고\"[블루엠텍 대해부...": {"score": 85, "label": "positive", "reasoning": "에스테틱 유통 확대로 확실한 흑자 전환 및 매출 2천억 목표 제시"},
    "Xcell Therapeutics Hits Upper Limit...Celemics·QuadMedicine ↑[K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "엑셀세라퓨틱스 상한가 등 강세장 영문 브리핑"},
    "한상열 인제니아 대표 “추가 기술수출·5년 누적 매출 8000억 기대”": {"score": 80, "label": "positive", "reasoning": "추가 기술수출 임박 및 5년 누적 매출 8천억 대규모 가이던스"},
    "MediPost hits limit on Japan valuation...Hyundai Bio rallies[K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "메디포스트 일본 기업가치 재평가에 따른 상한가"},
    "'시총 6·11·26조 기업들과 동시 협상'… 비엘팜텍, 분자접착제로 조 단위 빅딜 정조준": {"score": 85, "label": "positive", "reasoning": "조 단위 빅딜 및 수조원대 파트너사 협상 모멘텀"},
    "[2026 유망바이오 톱10]전립선암 치료제 상용화 초읽기 셀비온, 기업가치 ‘퀀텀점프’ 예고⑦": {"score": 80, "label": "positive", "reasoning": "전립선암 상용화 초읽기 진입 및 조건부 허가 기업가치 퀀텀점프 기대"},
    "신태현 대표 “나노구조체 '인비니티', MRI조영제·ADC 겨냥”[인벤테라 대해부①]": {"score": 75, "label": "positive", "reasoning": "ADC 분야로의 파이프라인 확장 및 신규 사업영역 제시"},
    "남학현 아이센스 대표 “라이프스캔과 독점계약 아냐…성과입증시 확장”": {"score": 60, "label": "neutral", "reasoning": "글로벌 계약 성사이나 독점은 아니며 조건부 성과 연동이라는 보수적 시각"},
    "[2026 유망바이오 톱10]‘텐배거’ 씨어스테크놀로지, 원격 환자 모니터링 시장 장악⑤": {"score": 85, "label": "positive", "reasoning": "원격 모니터링 시장 장악 및 주가 1138% 상승 등 텐배거 모멘텀 조명"},
    "'주식 병합' 경남제약, 상한가 직행...바이젠셀·비보존제약도 ↑[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "주식 병합에 따른 유통 주식수 감소 모멘텀으로 상한가"},
    "뎅기열 '팬데믹' 직면한 베트남, K-바이오 ‘구원투수’ 될까": {"score": 80, "label": "positive", "reasoning": "베트남 비상사태에 따른 현대바이오 임상의 당위성 및 수요 폭발 전망"},
    "“소아부터 노인까지 시장 무한 확장” 형상기억 투명교정장치[그래피 대해부]②": {"score": 75, "label": "positive", "reasoning": "통증 경감을 강점으로 전 연령대로 타겟 시장을 무한 확장"},
    "[2026 유망바이오 톱10]큐리언트, ‘모카시클립’ 잠재력 끌어낼 한 해⑨": {"score": 75, "label": "positive", "reasoning": "시총 8배 상승에 이은 핵심 약물 잠재력 입증 원년 예고"},
    "파로스아이바이오 '강세'…오름테라퓨틱, 신고가 경신[바이오 맥짚기]": {"score": 85, "label": "positive", "reasoning": "25%대 급등 및 오름테라퓨틱 신고가 돌파로 우상향 추세 입증"},
    "\"회생계획안 결의만 남았다\" 동성제약 인수 추진하는 태광산업...왜?": {"score": 70, "label": "positive", "reasoning": "태광산업의 자금수혈 및 피인수에 따른 재무구조 안정화 기대감"},
    "\"3년 내 美매출 수백억원 기대…관세·기술 유출도 완벽 대비”[그래피 대해부]③": {"score": 75, "label": "positive", "reasoning": "미국 매출 구체적 타임라인(3년내 수백억) 및 수출 리스크 사전 차단"}
}

matched_count = 0
for article in articles:
    title = article.get('title', '')
    if title in results_map:
        article['sentiment_score'] = results_map[title]['score']
        article['sentiment_label'] = results_map[title]['label']
        article['gemini_reasoning'] = results_map[title]['reasoning']
        matched_count += 1

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(articles, f, ensure_ascii=False, indent=4)

print(f"✅ Successfully updated {matched_count} more manual analysis results to {output_file}")
