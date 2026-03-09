import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    # 269~292번 기사들 (최신 기사 포함)
    "이뮨온시아, 국산 1호 PD-L1 면역항암제 상용화 박차": {"score": 80, "label": "positive", "reasoning": "국산 1호 면역항암제 상용화 임박 및 시장 선점 기대감"},
    "AI소재기업 거듭난 파미셀, CDMO·원료의약품 사업 확대 '드라이브'": {"score": 75, "label": "positive", "reasoning": "원료의약품 CDMO 사업 확장 및 실적 개선 기대감"},
    "현대바이오, 뎅기열 치료제 임상 2·3상 진입 초읽기...‘베트남 보건 실세 총출동’": {"score": 85, "label": "positive", "reasoning": "베트남 정부 지원 하에 뎅기열 치료제 임상 가속화 및 상용화 가능성 증대"},
    "'검은 화요일' 속 빛난 바이오株…우정바이오·국전약품·시지메디텍 나란히 상승[바이오맥짚...": {"score": 80, "label": "positive", "reasoning": "시황 하락(Black Tuesday)에도 불구하고 개별 호재로 동반 상승하며 투심 방어"},
    "‘AOC가 뭐길래’ 진양곤 HLB 의장의 파나진 잇단 지분 매수 배경은": {"score": 75, "label": "positive", "reasoning": "오너의 지속적인 지분 매수를 통한 지배력 강화 및 사업 시너지 기대감"},
    "‘600억 소송까지’…한미그룹 경영권 분쟁 재점화에 외인 자금 엑소더스 우려": {"score": 30, "label": "negative", "reasoning": "경영권 분쟁 심화 및 소송 발생으로 인한 불확실성 증대와 외인 자금 유출 우려"},
    "K-액체생검, 아이엠비디엑스·지씨지놈 글로벌에서도 격돌 [용호상박 K바이오]": {"score": 70, "label": "positive", "reasoning": "액체생검 기술의 글로벌 경쟁력 부각 및 시장 확대 기대감"},
    
    # 200~260번대 사이 '분석 미진행' 기사들 보충
    "이의일 엑셀세라퓨틱스 대표 “대만 매출 두자릿수 이상 성장...화학조성배지로 패러다임 전환”": {"score": 75, "label": "positive", "reasoning": "해외 매출 성장 가시화 및 독보적 기술력을 통한 시장 패러다임 변화 주도"},
    "글로벌 시장 매출 확대 전망에 그래피·셀트리온 초강세[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "글로벌 점유율 확대 전망에 따른 강한 수급 유입 및 동반 급등장 연출"},
    "리가켐바이오, 1년새 항체 도입 6개…항체 강화 하는 이유": {"score": 75, "label": "positive", "reasoning": "적극적인 항체 라이선스 인을 통한 ADC 파이프라인 경쟁력 강화"},
    "아프리카돼지열병 전수조사 개시…동물진단 옵티팜 수혜 기대": {"score": 80, "label": "positive", "reasoning": "질병 발생에 따른 진단 키트 수요 급증 및 관 주도 전수조사 수혜"},
    "JPM Spotlight...CuroCell Eyes Korea’s First CAR-T [K-bio pulse]": {"score": 80, "label": "positive", "reasoning": "국내 최초 CAR-T 치료제 상용화 기대감 및 글로벌 컨퍼런스 주목"},
    "i-Sens Soars 23% on EU CGM Expansion [K-bio pulse]": {"score": 85, "label": "positive", "reasoning": "유럽 시장 점유율 확대 소식에 따른 23% 급등 및 성장판 오픈"},
    "셀루메드, 경영권 매각 기대감에 '上'...지놈앤컴퍼니·큐리옥스도 ↑ [바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "경영권 매각이라는 강력한 상방 재료와 섹터 동반 상승"},
    "김종우 듀켐바이오 부회장 “2026년 국내 유일 치매진단제 매출 두 배 증가 전망”": {"score": 80, "label": "positive", "reasoning": "치매 진단 시장 독점적 지위와 구체적인 매출 성장 가이던스 제시"},
    "전승호 코오롱티슈진 대표 \"TG-C, 세계 최초 무릎골관절염 근원치료제 기대\"": {"score": 80, "label": "positive", "reasoning": "세계 최초 근원치료제라는 상징성과 대규모 시장 창출 기대감"},
    "트럼프Rx 태풍속…'주력약 퇴출' 삼일↓·'M&A 기대' 오스코텍↑[바이오맥짚기]": {"score": 50, "label": "neutral", "reasoning": "정치적 변수에 따른 명암 교차 (삼일 악재, 오스코텍 호재 혼재)"},
    "엔솔바이오, 골관절염 치료제 임상 3상 승인...‘기술수출 논의 본격화 ’": {"score": 85, "label": "positive", "reasoning": "임상 3상 승인이라는 최종 관문 진입 및 기술 수출 기대감 최고조"},
    "“Xellar Effect”… Woojung Bio Jumps[K-Bio Pulse]": {"score": 80, "label": "positive", "reasoning": "신규 플랫폼 효과로 인한 강한 주가 반등세 시현"},
    "알테오젠, 일시적 투심하락 관망세 전환…삼양바이오팜 가파른 상승[바이오맥짚기]": {"score": 60, "label": "neutral", "reasoning": "대장주 하락과 중소형주 상승이 엇갈리는 장세"}
}

matched_count = 0
for article in articles:
    title = article.get('title', '')
    # Check both full title and a partial match if title is truncated in dictionary but exists in JSON
    for key, val in analysis_results.items():
        if key in title or title in key:
            article['sentiment_score'] = val['score']
            article['sentiment_label'] = val['label']
            article['gemini_reasoning'] = val['reasoning']
            matched_count += 1
            break

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(articles, f, ensure_ascii=False, indent=4)

print(f"✅ Successfully updated {matched_count} more analysis results, clearing 'Default' reasoning.")
