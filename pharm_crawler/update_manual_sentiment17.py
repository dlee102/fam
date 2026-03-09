import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "삼천당제약, 공시엔 없던 5.3조원...거래소 “계약서에도 없던 숫자”": {"score": 35, "label": "negative", "reasoning": "보도된 계약 규모(5.3조원)에 대한 거래소의 미확인 입장 발표로 인한 신뢰 도산 및 투자 심리 위축"},
    "韓·日 빅마파 어나프라주 판매 러브콜 비보존": {"score": 85, "label": "positive", "reasoning": "한미약품 등 대형 제약사와의 공동 판매 계약 및 글로벌 기술 이전 논의로 인한 실적 기대감"},
    "엘앤씨바이오·광동제약과 혈맹' 휴메딕스, 올해 기대되는 이유": {"score": 80, "label": "positive", "reasoning": "전략적 지분 교환(혈맹) 및 CMO 사업 확대를 통한 사업 시너지와 안정적 실적 기반 확보"},
    "AprilBio Swings from Cold to Hot": {"score": 85, "label": "positive", "reasoning": "임원 지분 매도 악재를 압도하는 미국 파트너사의 임상 2a상 성공 발표로 상한가 반전"},
    "제일바이오, 2만9000% 상승 착시효과": {"score": 20, "label": "negative", "reasoning": "상장 폐지 전 구조적 착시에 의한 급등으로 투기적 수요 주의보"},
    "방사성의약품 신약 상용화를 앞둔 셀비온": {"score": 80, "label": "positive", "reasoning": "머크(MSD)와의 병용 임상 및 중국 기술 수출 기대감으로 인한 기업 가치 상승"},
    "보로노이 미국지사장 \"고형암 신약 VRN 10·VRN11 기술 이전 총력": {"score": 75, "label": "positive", "reasoning": "핵심 파이프라인의 글로벌 기술 이전을 위한 적극적인 사업 개발 활동 지속"},
    "Samil Plunges on 'Main Drug Withdrawal'": {"score": 35, "label": "negative", "reasoning": "미국 정책 변수(TrumpRx)로 인한 주력 약물 시장 퇴출 우려 및 주가 폭락"},
    "엠투웬티, ‘근손실 0.4%’ 중주파로 SCI저널 등재": {"score": 75, "label": "positive", "reasoning": "자체 기술의 SCI급 논문 등재를 통한 글로벌 메디컬 시장 진출 신뢰도 확보"},
    "젬백스 김상재 고문 \"GV1001, PSP 환자들에게 마지막 희망 될 것": {"score": 70, "label": "positive", "reasoning": "희귀 질환 치료제 조건부 허가 신청을 통한 상용화 시도 및 기술적 가치 입증"}
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
