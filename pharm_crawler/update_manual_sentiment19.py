import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "레몬헬스케어 대표 \"상급병원 80%·매출 160억 달성": {"score": 75, "label": "positive", "reasoning": "이미 구축된 국가 인프라 기반의 안정적인 수익 구조와 높은 시장 점유율 입증"},
    "디앤디파마텍·퍼스트바이오 공동 개발 뇌질환 신약 기술이전": {"score": 85, "label": "positive", "reasoning": "퇴행성 뇌질환 치료제(NLY02)의 구체적인 글로벌 기술 이전 논의 및 성사 임박"},
    "비엘팜텍 5연상…젬백스도 상승세 지속": {"score": 90, "label": "positive", "reasoning": "분자접착제 기술 수출 기대감에 따른 5거래일 연속 상한가 및 섹터 호재 지속"},
    "Cellumed Hits Upper Limit on Hopes for Ownership Sale": {"score": 85, "label": "positive", "reasoning": "경영권 매각 협상 가속화 및 조기 대금 납입 소식에 따른 상한가"},
    "국내 첫 방사선의약품 상용화 임박... 다음 행보는": {"score": 80, "label": "positive", "reasoning": "신약 상용화 임박 및 글로벌 파트너십 확대를 통한 기업 가치 상승"},
    "알테오젠 SC기술, 블록버스터 항암제 임핀지에도 적용": {"score": 85, "label": "positive", "reasoning": "키트루다에 이어 블록버스터 항암제 임핀지(Imfinzi)로의 플랫폼 확장 및 임상 가속화"},
    "아이엠비디엑스, 올해 매출 100억·흑자 전환 예고": {"score": 80, "label": "positive", "reasoning": "액체 생검 시장 내 입지 강화 및 매출 급증을 통한 흑자 전환 로드맵 제시"},
    "앱클론 원천기술 적용' HLX22에 베팅한 헨리우스": {"score": 80, "label": "positive", "reasoning": "앱클론 원천 기술이 적용된 신약의 상업화 성공 가능성에 따른 글로벌 파트너사의 공격적 투자"},
    "ToolGen revalued after U.S. EU patent wins": {"score": 85, "label": "positive", "reasoning": "미국·유럽 내 유전자 가위 특허 승인을 통한 플랫폼 가치 재평가"},
    "우정바이오, 차세대 비임상 기대감에 급등": {"score": 80, "label": "positive", "reasoning": "신규 비임상 플랫폼 '엑셀라' 효과에 따른 기술 경쟁력 부각 및 급등"}
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
