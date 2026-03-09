import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

# Batch of 50 more unanalyzed articles
analysis_results = {
    "글로벌 파트너 신뢰 입증...한미·리가켐, 상용화 전 판권 잇단 계약": {"score": 85, "label": "positive", "reasoning": "글로벌 상용화 전 판권 계약을 통한 신약 경쟁력 입증 및 선제적 매출 확보"},
    "Pharos iBio Surges...Orum Therapeutics Hits New High[K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "지분 구조 재료로 25% 급등 및 오름의 52주 신고가 기록 (추세 강화)"},
    "Cellumed, DXVX…Buoyed By Major Shareholders' Investments [K-Bio Pulse]": {"score": 75, "label": "positive", "reasoning": "대주주 투자 유치를 통한 자금 조달 및 경영 안정화 기대감"},
    "Shares of Kwangdong Soar as FDA Approves Presbyopia Eye Drop...U2Bio·CorestemChemon ↑[K-Bio Pul...": {"score": 90, "label": "positive", "reasoning": "FDA 승인이라는 제약 바이오 상업화의 최종 관문 통과 및 상한가 급등"},
    "日 진출 메디포스트, 7000억 가치 평가에 上…현대바이오도 급등[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "일본 시장 진출 및 수천억대 가치 재평가 부각으로 인한 상한가 도달"},
    "‘신장 되돌리는 약’ 될까…큐라클 CU01, 2b상 결과 임박": {"score": 80, "label": "positive", "reasoning": "신기능 회복(역주행) 신호 재현 여부에 따른 임상 2b상 결과 기대감 증폭"},
    "기술 이전 성과 낸 K바이오, IPO출격 대비...제2의 알테오젠 누가될까": {"score": 70, "label": "positive", "reasoning": "기술 이전 성과를 바탕으로 한 바이오 기업들의 IPO 흥행 및 섹터 활기 기대"},
    "오종민 와이투솔루션 부사장 “올해 3대 첨단 사업 대전환점… 매출 더블업 성장 예고”": {"score": 85, "label": "positive", "reasoning": "제조업 탈피 및 첨단 바이오 신약 매출 실질화로 인한 기업 가치 1조 목표"},
    "이돈행 넥스트바이오메디컬 대표 \"내년 흑자전환...5년 내 매출 1000억 돌파\"": {"score": 80, "label": "positive", "reasoning": "내년 흑회 및 중장기 매출 1천억 달성 가이던스 제시"},
    "\"올체 매출 3분의 1 기대\"...'리투오'에 힘 싣는 엘앤씨바이오": {"score": 75, "label": "positive", "reasoning": "핵심 신제품(리투오)의 폭발적 매출 비중 확대 및 생산 능력 증설 호재"},
    "'‘플루빅토보다 싸고 쎄다'…셀비온, 中 러브콜 ‘재점화’": {"score": 80, "label": "positive", "reasoning": "중국 시장 내 경쟁 우위 입증 및 다수 제약사로부터의 기술 이전 러브콜 가시화"},
    "김선우 딥바이오 대표 \"직원 감소로위기? 300개 GPU가 대신한다\"": {"score": 60, "label": "neutral", "reasoning": "조직 효율화(감원) 논란 속 경영 전략 수정 보도 (중립적 시각)"},
    "WSI Surges 16%...Cellumed Hits Limit Down [K-bio pulse]": {"score": 50, "label": "neutral", "reasoning": "개별 종목별 명암 교차 (WSI 급등, 셀루메드 하한가)"},
    "주식상장, 미국 진출 및 기술 이전으로 성장 박차\"[지브레인 대해부③]": {"score": 75, "label": "positive", "reasoning": "상장 및 미국 진출 가시화에 따른 성장 동력 확보"},
    "LG AI연구원 솔루션 도입 엔젠바이오 '上'...기술 이전에도 알테오젠↓[바이오맥짚기]": {"score": 70, "label": "positive", "reasoning": "대기업 AI 기술 도입으로 인한 상한가 및 대장주 알테오젠의 일시적 조정"},
    "'글로벌사와 유통 계약 조율' 엘앤케이바이오, 생산 능력 확대로 승부수": {"score": 80, "label": "positive", "reasoning": "글로벌 유통 계약 임박 및 생산 CAPA 확대를 통한 외형 성장 전략"},
    "SK바이오팜, 엑스코프리 2차 처방 집중...'매출 60% 증가 기대'": {"score": 85, "label": "positive", "reasoning": "미국 시장 내 처방 확대 가속화 및 공격적인 매출 성장 전망"},
    "CellBioN, Quracle Spark Commercialization Hopes[K-bio pulse]": {"score": 80, "label": "positive", "reasoning": "상용화 기대감에 따른 바이오텍 센티먼트 개선"},
    "‘든든한 우군’ 동국제약·동국생명과학 3년 락업 협약[인벤테라 대해부②]": {"score": 70, "label": "positive", "reasoning": "전략적 파트너사의 락업 협약을 통한 경영권 안정 및 장기 협력 기반 마련"},
    "'좀비 바이오' 퇴출 빨라진다…'상폐 요주의' 기업은?": {"score": 30, "label": "negative", "reasoning": "상장 폐지 요건 강화에 따른 시장 정화 및 한계 기업 리스크 부각 (섹터 내 부정적 노이즈)"},
    "Investment Sentiment Shifts to Mid Risk...High Return Bio Stocks: Samyang Biopharm and U2Bio Surg...": {"score": 80, "label": "positive", "reasoning": "중위험 고수익 종목군으로의 자금 유입 및 실적주 강세"},
    "시장 주류로 떠오른 인체유래 스킨부스터...엘엔씨바이오 등 기업가치 제고 '주목'": {"score": 75, "label": "positive", "reasoning": "차세대 미용 시장 주도권 확보 및 관련 기업 가치 상승"},
    "\"AI·온라인 플랫폼 중심의 의약품 유통 디지털 전환 박차\"[블루엠텍 대해부②]": {"score": 75, "label": "positive", "reasoning": "유통 구조 혁신을 통한 디지털 전환 가속화"},
    "삼익제약, 주가 50% 띄운 장기지속형 플랫폼…뜯어보니 기술 경쟁력↓": {"score": 40, "label": "negative", "reasoning": "기대감에 의한 단기 급등 후 기술력 의구심 제기 리포트 (실망 매물 우려)"},
    "돈되는 환자 모니터링 시장, 씨어스 vs 메쥬...시장 재편될까[용호상박 K바이오]": {"score": 70, "label": "positive", "reasoning": "시장 개화에 따른 투심 개선 및 경쟁을 통한 파이 확대"},
    "미용의료기기 시총 왕좌 내준 파마리서치, 1위 오른 클래시스…해외 확장 속도가 '키'": {"score": 70, "label": "positive", "reasoning": "미용 기기 시장 내 순위 변동 및 해외 확장 중심의 긍정적 경쟁 구도"},
    "독일 판매 막힌 키트루다SC, 하반기 유럽서 판매금지 늘어날까": {"score": 35, "label": "negative", "reasoning": "특허 분쟁에 따른 판매 금지 가능성 및 관련 수혜/피해 우려"},
    "삼성·롯데·셀트리온, 美 CDMO 공장 스펙 뜯어봤더니": {"score": 70, "label": "positive", "reasoning": "글로벌 CDMO 시장 내 국내 대기업들의 경쟁력 비교 및 설비 경쟁 우위 분석"},
    "고종성 제노스코 대표 “진짜 치료하는 폐섬유증 신약 자신…잠재가치 2조 넘을 것”": {"score": 80, "label": "positive", "reasoning": "미세 타겟 폐섬유증 신약 가치 2조원 평가 및 대표의 강한 상용화 의지"},
    "최대주주 지분 희석의 후폭풍…경영권 흔들리는 바이오기업은": {"score": 40, "label": "negative", "reasoning": "지배구조 불안정 및 지분 희석 이슈를 통한 투심 위축 주의보"}
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

print(f"✅ Successfully updated {matched_count} more results.")
