import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "클래시스 볼뉴머, \"효능 높이고 통증 줄였다\"…써마지 넘어 中1.4조": {"score": 85, "label": "positive", "reasoning": "임상 데이터를 통해 증명된 경쟁 우위를 바탕으로 1.4조원 규모의 중국 미용 의료 시장 재편 예고"},
    "인체 유래 ECM 스킨부스터, 미용인가 치료인가": {"score": 65, "label": "neutral", "reasoning": "ECM 스킨부스터의 시장 파급력은 크나 규제 사각지대에 따른 우려 공존"},
    "아미코젠 \"올해 배지·레진 신사업 매출 약 200억 전망": {"score": 75, "label": "positive", "reasoning": "신사업 매출 본격화 및 유상증자 마무리를 통한 우량 자산 중심의 체질 개선 기대"},
    "'창업자 별세' 오스코텍, 경영권 전망과 제노스코 지분 인수": {"score": 40, "label": "negative", "reasoning": "상속세 문제로 인한 최대주주 변경 가능성 및 지배구조 불확실성 증대"},
    "카나프테라퓨틱스, 투자 핵심 포인트 세 가지": {"score": 80, "label": "positive", "reasoning": "롯데바이오로직스 등 대형 파트너십과 ADC 플랫폼 경쟁력을 바탕으로 한 IPO 흥행 기대"},
    "'해외 창업' K바이오, 기술 이전 실적 앞세워 줄줄이 코스닥행": {"score": 75, "label": "positive", "reasoning": "글로벌 성과를 보유한 해외 창업 바이오 기업들의 코스닥 상장 본격화"},
    "바이젠셀, 보령發 오버행 부담 조기 해소": {"score": 80, "label": "positive", "reasoning": "주가를 억눌러온 2대 주주의 물량(오버행) 해소 및 CMO 사업 확대를 통한 실적 개선 기반 마련"},
    "조영제 해외 출시·글로벌 기술이전으로 2028년 흑전 예고": {"score": 75, "label": "positive", "reasoning": "조영제 조기 상용화 및 일본 진출 등을 통한 흑자 전환 로드맵 가시화"},
    "장기지속형 주사 새해에도 힘받는다...지투지바이오·삼익제약 ↑": {"score": 85, "label": "positive", "reasoning": "독보적 약물 전달 기술력을 보유한 지투지바이오 등 차세대 제형 기술주로의 저가 매수세 유입"},
    "Y2Solution and U2Bio Surge on Rising Expectations": {"score": 85, "label": "positive", "reasoning": "성장 기대감 및 대형 파트너십 이슈로 인한 주가 급등 시현"}
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
