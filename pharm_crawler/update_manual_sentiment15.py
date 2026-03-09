import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "[2026 유망바이오 톱10]'3000억 현금 무장' 오름테라퓨틱": {"score": 85, "label": "positive", "reasoning": "지분 발행을 통해 3천억 규모의 현금을 확보하며 적극적인 기술 도입 및 외형 확장 기반 마련"},
    "천두성 포스트바이오 대표 “반려동물부터 가축까지, 전천후 동물헬스케어": {"score": 75, "label": "positive", "reasoning": "라파스 피인수 후 반려동물 암 치료 진단 등 동물 헬스케어 시장 점유율 확대 전략"},
    "웰리시스, 180억 프리IPO 완료": {"score": 75, "label": "positive", "reasoning": "삼성전자 협력 및 해외 확장성을 인정받아 대규모 투자 유치 성공, 상장 발판 마련"},
    "'키트루다 SC' J-코드 확보…알테오젠, SC제형 전환": {"score": 85, "label": "positive", "reasoning": "미국 정식 보험청구 코드(J-코드) 확보로 키트루다 SC 제형의 처방 급증 및 알테오젠 수혜 가시화"},
    "AI Drug Discovery & Medical Sectors Take Flight": {"score": 80, "label": "positive", "reasoning": "실질적 레퍼런스와 실적(숫자)을 갖춘 의료 AI 기업들로의 강력한 수급 유입"},
    "오상훈 오가노이드사이언스 대표 “성장 전략 대전환": {"score": 75, "label": "positive", "reasoning": "병원 기반 CRDMO로의 체질 개선을 통한 수익 구조 고도화 및 규모의 경제 실현"},
    "삼일제약, 연골 되돌리는 로어시비빈트로 수천억 '잭팟'": {"score": 85, "label": "positive", "reasoning": "세계 최초 골관절염 근본 치료제(DMOAD) 후보군의 국내 독권 확보 및 상업화 기대"},
    "이영신 씨어스 대표 “환자 모니터링 사업, 수가 전략이 10년 데스밸리 끝냈다”": {"score": 80, "label": "positive", "reasoning": "수가 적용을 통한 사업 모델 혁신으로 장기 침체기를 벗어나 텐배거 기업으로 도약"},
    "박주철 하이센스바이오 대표 \"절치부심, 기평 재신청으로 세 번째 상장 도전\"": {"score": 70, "label": "positive", "reasoning": "지속적인 도전을 통한 기술성 평가 재신청 및 상장 의지 표명"},
    "HLB, 신약 상업화 체제 전환 본격화": {"score": 80, "label": "positive", "reasoning": "리보세라닙의 상업화 체제 구축 및 매출 목표치 상향 조정을 통한 실질적 성과 창출 의지"}
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
