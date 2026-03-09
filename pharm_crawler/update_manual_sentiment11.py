import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "중우시 '945개 美프로젝트', K바이오의 기회": {"score": 85, "label": "positive", "reasoning": "미국 생물보안법 통과로 중국 우시의 945개 프로젝트가 시장에 매물로 나오며 국내 CDMO 기업들의 반사 이익 기대감"},
    "바이오 최대 행사 JPMHC 주목…큐로셀, 국산 1호 CAR-T 기대": {"score": 85, "label": "positive", "reasoning": "JPMHC 기대감 고조 및 큐로셀의 국산 1호 CAR-T 품목허가 임박에 따른 강력한 상승 동력"},
    "'먹는 위고비' 출시 직후 예상 상회…디앤디파마텍, 몸값도 뛴다": {"score": 85, "label": "positive", "reasoning": "경구용 비만치료제의 압도적 처방 수치 확인으로 경구 전환 기술 보유 기업인 디앤디파마텍 가치 재평가"},
    "극심한 정보 비대칭, 삼천당제약 숫자가 시장을 압도할 때": {"score": 95, "label": "positive", "reasoning": "5.3조원 규모의 초대형 비만치료제 공급 계약으로 기업가치 19조원 돌파 및 신뢰도 수직 상승"},
    "'2% 로열티'가 무너뜨린 신뢰…알테오젠發 바이오株 동반 하락": {"score": 30, "label": "negative", "reasoning": "예상보다 낮은 로열티율 공개로 인한 개별 종목 신뢰 훼손 및 섹터 전반의 동반 급락 유발"},
    "씨엔알리서치, 동전주 퇴출 위기?...해외 매출 확대·M&A로 돌파": {"score": 65, "label": "positive", "reasoning": "동전주 상폐 리스크 우려가 있으나 역대 최대 실적 경신 및 글로벌 확장 전략으로 정면 돌파 시도"},
    "박진영 용인세브란스 정신과 교수 \"슬립큐로 불면증 사각지대 해결": {"score": 75, "label": "positive", "reasoning": "디지털 치료제(DTx) 처방 활성화 및 슬립큐의 시장 안착 가속화"},
    "라파스, 마이크로니들 비만 패치 반감기": {"score": 80, "label": "positive", "reasoning": "기존 주사제 대비 긴 반감기와 높은 생체이용률 확인으로 차세대 비만 치료제 경쟁력 부각"},
    "경쟁사 황반변성치료제 치료 효과 수개월...NG101, 최소 5년 지속": {"score": 85, "label": "positive", "reasoning": "기존 수개월 단위 투약을 5년 단위로 혁신한 유전자 치료제(NG101)의 압도적 편의성과 기술적 우위"},
    "뇌신호 읽는 기술 앞세워 한국의 뉴럴링크 도약": {"score": 80, "label": "positive", "reasoning": "독보적인 BCI 기술력을 바탕으로 한 한국형 뉴럴링크로서의 성장 잠재력 부각"},
    "무릎 외 척추 등 AI영상진단 SW 차례로 출시": {"score": 75, "label": "positive", "reasoning": "진단 부위 확대 및 수술 로봇 상용화를 통한 AI 의료 시장 내 지배력 강화"}
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
