import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "시총 100조' 노리는 삼성바이오로직스, 美공장 인수 효과": {"score": 90, "label": "positive", "reasoning": "미국 공장 인수를 통한 관세 리스크 해소 및 글로벌 CDMO 지배력 강화로 시총 100조 달성 기대"},
    "클래시스 볼뉴머, \"효능 높이고 통증 줄였다\"…중국 1.4조 시장": {"score": 85, "label": "positive", "reasoning": "임상 데이터를 통해 증명된 경쟁 우위를 바탕으로 1.4조원 규모의 중국 미용 의료 시장 재편 예고"},
    "Graphy, Celltrion rally on global revenue prospects": {"score": 80, "label": "positive", "reasoning": "글로벌 매출 확대 전망에 따른 그래피와 셀트리온의 동반 랠리"},
    "피플앤드테크놀러지 대표 \"환자 모니터링 연계 플랫폼": {"score": 75, "label": "positive", "reasoning": "벤더 중립형 구독 모델을 통한 병원 자동화 시장 내 입지 강화 및 성장세 지속"},
    "'셀트리온 신약 파트너' 카이진 \"누적 기술 이전 규모 2조원": {"score": 85, "label": "positive", "reasoning": "2조원대 대규모 기술 이전 성과를 바탕으로 한 내년 코스닥 상장 기대감 증폭"},
    "ECM 제품에 3D 안면스캐너 기술 접목\"...레이, 에스테틱 신사업": {"score": 80, "label": "positive", "reasoning": "3D 스캔 기술과 바이오 소재의 결합을 통한 에스테틱 신시장 개척 및 시너지 창출"},
    "No Envy for Semis... Intron Bio, Gencurix Hit Upper Limit": {"score": 90, "label": "positive", "reasoning": "반도체 랠리를 이어받은 바이오 섹터의 폭발적 성장세 및 조 단위 계약 가능성 부각"},
    "산업銀·K백신펀드 1·2·3호 운영사 동시 투자한 혁신신약": {"score": 85, "label": "positive", "reasoning": "국내 최초 대규모 정책 펀드들의 동시 투자 유치로 입증된 독보적 기술력과 신뢰도"},
    "'실질적 성과' 기대에 몰린 투심…엔솔바이오·엘앤케이바이오": {"score": 80, "label": "positive", "reasoning": "임상 3상 승인 등 실질적 성과 가시화에 따른 강력한 매수세 유입"},
    "큐라클 CU01 칼륨 걱정 줄이고 신장 지킨다": {"score": 80, "label": "positive", "reasoning": "안전성과 유효성을 동시에 확보한 당뇨병성 신증 치료제 임상 기대감"}
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
