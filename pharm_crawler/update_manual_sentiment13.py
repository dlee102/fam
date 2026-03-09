import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "리보세라닙' FDA허가 표류 속 주가는 견고…HLB": {"score": 65, "label": "neutral", "reasoning": "FDA 허가 재신청 기대감과 불확실성이 공존하는 '그레이존' 구간 지속"},
    "김지윤 칠곡경북대병원 교수 “헴리브라, 4주간 혈중 농도 일정 유지": {"score": 80, "label": "positive", "reasoning": "실제 의료 현장에서의 데이터 축적 및 소아 환자 대상 높은 순응도 입증"},
    "최대 3831억 상장 시총 도전' 아이엠바이오로직스": {"score": 75, "label": "positive", "reasoning": "항체 치료제 기술력을 바탕으로 한 대형 바이오 IPO 기대감"},
    "NGeneBio Hits Upper Price Limit After Adopting LG AI Research Institute’s Solution": {"score": 85, "label": "positive", "reasoning": "LG AI 연구원 솔루션 도입으로 인한 AI 의료 데이터 기업으로의 진화 기대 및 상한가"},
    "몸값 거품' 불식시킨 리브스메드…기술특례 불신의 늪 마침표": {"score": 90, "label": "positive", "reasoning": "상장 후 시총 2조원 돌파하며 기술특례 기업의 실질적 가치 입증 및 신뢰 회복"},
    "박정환 메쥬 대표 “환자 모니터링 시장 재편": {"score": 75, "label": "positive", "reasoning": "응급 대응 및 통합 모니터링 솔루션을 통한 시장 재편 의지 표명"},
    "무한 확장 신약 개발 플랫폼…황금알 낳는 거위 후보는?": {"score": 75, "label": "positive", "reasoning": "단일 파이프라인 리스크를 분산하고 무한 확장이 가능한 플랫폼 기술의 중요성 부각"},
    "‘짐머 파워’ 폭발…오스테오닉, 글로벌 공급망 편입": {"score": 85, "label": "positive", "reasoning": "글로벌 공룡 짐머(Zimmer)와의 협업 및 OEM/ODM 매출 급증으로 역대 최대 실적 경신"},
    "알테오젠 로열티율 공개로 빅파마·K바이오텍 힘의 불균형": {"score": 40, "label": "negative", "reasoning": "빅파마와의 구조적 불평등 노출 및 파트너사와의 협의 없는 정보 공개로 인한 신뢰 타격"},
    "카티라이프 효과 확실...수술 20개월 차에도 초자연골 계속 재생": {"score": 80, "label": "positive", "reasoning": "자가 세포 이용 치료제인 카티라이프의 장기적 유효성 및 실제 환자 사례를 통한 기술력 입증"}
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
