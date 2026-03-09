import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

analysis_results = {
    "오름, 6개월 만에 주가 6.3배 '껑충'…저평가 국면 벗어난 이유": {"score": 90, "label": "positive", "reasoning": "DAC 파이프라인 희소성 및 대규모 자금 조달로 인한 저평가 국면 탈출"},
    "의료기기 삼총사 약진...그래피·리브스메드·WSI 급등[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "독점적 기술력을 확보한 의료기기 섹터로의 강한 수급 쏠림 현상"},
    "아프리카돼지열병 유행에 코미팜↑…'로슈 파트너' 바이오다인도 주목[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "질병 유행에 따른 백신주 강세 및 지분 취득 공시에 따른 경영권 강화 호재"},
    "우주·동물약·M&A…제약업계 '오너 3세' 신사업 실험 한창": {"score": 60, "label": "neutral", "reasoning": "오너 3세들의 다양한 신사업 도전에 따른 기업별 명암 교차 분석"},
    "'키트루다 SC' 2% 로열티 논란…알테오젠, 다른 계약은 괜찮을까": {"score": 45, "label": "negative", "reasoning": "예상보다 낮은 로열티율(2%) 확인에 따른 플랫폼 가치 재평가 우려"},
    "LG화학도 탐냈던 AI신약개발사 히츠": {"score": 75, "label": "positive", "reasoning": "AI 신약 개발 역량 부독점 및 산학 협력 기반의 강력한 R&D 경쟁력"},
    "\"중국 진출·홈케어 시장 침투\"…클래시스, 4조 몸값 회복 나선다": {"score": 80, "label": "positive", "reasoning": "중국 시장 본격 공략 및 홈케어 확장을 통한 시총 4조원 회복 가이던스"},
    "엔도로보틱스 공동대표들 \"지분욕심 내는 순간 패착": {"score": 70, "label": "positive", "reasoning": "사제 공동 창업의 기술 신뢰도 및 경영 안정성 기반 구축"},
    "풀리지 않는 탈모 해법 찾을까...프롬바이오·현대약품 ↑[바이오맥짚기]": {"score": 80, "label": "positive", "reasoning": "탈모 치료제 임상 진입 기대감 및 국내 독점 권리 확보에 따른 매수세 유입"},
    "레이저옵텍, 성장 엔진 재가동...혈관 레이저 등 신제품 앞세워 '실적 반등'": {"score": 80, "label": "positive", "reasoning": "소송 리스크 해소 및 세계 최초 피코레이저 등 신제품 출시를 통한 턴어라운드"},
    "이의일 엑셀세라퓨틱스 대표 “대만 매출 두자릿수 이상 성장": {"score": 75, "label": "positive", "reasoning": "해외 매출 가시화 및 화학조성배지 시장 선점"},
    "리가켐바이오, 1년새 항체 도입 6개": {"score": 75, "label": "positive", "reasoning": "적극적 항체 확보를 통한 ADC 플랫폼 경쟁력 강화"},
    "아프리카돼지열병 전수조사 개시…동물진단 옵티팜 수혜 기대": {"score": 80, "label": "positive", "reasoning": "정책적 전수조사 실시에 따른 진단 키트 수요 폭증 및 수혜"},
    "JPM Spotlight...CuroCell Eyes Korea’s First CAR-T": {"score": 80, "label": "positive", "reasoning": "국내 최초 CAR-T 상용화 기대감 및 글로벌 주목"},
    "i-Sens Soars 23% on EU CGM Expansion": {"score": 85, "label": "positive", "reasoning": "유럽 내 연속혈당측정기 시장 확대에 따른 23% 급등"},
    "셀루메드, 경영권 매각 기대감에 '上'": {"score": 85, "label": "positive", "reasoning": "경영권 매각이라는 강력한 상방 트리거로 상한가 기록"},
    "삼익제약, 주가 50% 띄운 장기지속형 플랫폼…뜻어보니": {"score": 40, "label": "negative", "reasoning": "단기 급등 후 기술 경쟁력 의구심 제기 및 실망 매물 우려"},
    "김종우 듀켐바이오 부회장 “2026년 국내 유일 치매진단제 매출 두 배": {"score": 80, "label": "positive", "reasoning": "독점적 치매 진단제 시장 지위 및 매출 2배 성장 가이던스"},
    "돈되는 환자 모니터링 시장, 씨어스 vs 메쥬": {"score": 70, "label": "positive", "reasoning": "시장 개화 및 경쟁을 통한 가치 상승"},
    "미용의료기기 시총 왕좌 내준 파마리서치": {"score": 70, "label": "positive", "reasoning": "순위 변동 속에서 확인된 섹터 내 해외 확장 경쟁력"},
    "전승호 코오롱티슈진 대표 \"TG-C, 세계 최초 무릎골관절염": {"score": 80, "label": "positive", "reasoning": "세계 최초 근원치료제 기대감 및 강력한 파이프라인 가치"},
    "트럼프Rx 태풍속…'주력약 퇴출' 삼일↓·'M&A 기대' 오스코텍↑": {"score": 50, "label": "neutral", "reasoning": "대외 정책 변수에 따른 종목별 차별화 양상"},
    "엔솔바이오, 골관절염 치료제 임상 3상 승인": {"score": 85, "label": "positive", "reasoning": "임상 3상 승인 및 기술 이전 협상 본격화"},
    "“Xellar Effect”… Woojung Bio Jumps": {"score": 80, "label": "positive", "reasoning": "신규 플랫폼 효과에 따른 강한 반등"}
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

print(f"✅ Successfully updated {matched_count} results from unanalyzed batch.")
