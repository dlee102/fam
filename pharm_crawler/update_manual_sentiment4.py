import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

# Update the sentiments we just discussed for indexes 210~259
results_map = {
    "지난해 흑자전환 성공한 지엘팜텍, 실적 퀀텀점프 복안은?": {"score": 75, "label": "positive", "reasoning": "흑자 전환 성공에 이은 안구건조증 신약 등 실적 퀀텀점프 비전 제시"},
    "반도체주 안 부럽다...인트론바이오·젠큐릭스 등 상한가 신고[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "반도체 랠리 바통을 이은 폭발적 테마 상승장 (상한가) 및 조단위 계약 체결 모멘텀"},
    "'SK·롯데' 오너 3세 바이오사업에 전진 배치한 까닭은?": {"score": 75, "label": "positive", "reasoning": "대기업의 오너 일가 파견을 통한 바이오 사업의 전략적, 전사적 육성 의지 표명"},
    "환자 모니터링 시장 경쟁 자신한 메디아나…실제 경쟁력은": {"score": 60, "label": "neutral", "reasoning": "원격 모니터링 시장 신규 진입 포부이나 기존 강자(씨어스 등)와의 경쟁에서 객관적 우위 증명 필요 (중립적 분석)"},
    "윤인영 분당서울대병원 교수 \"앱노트랙, 수면무호흡증시장 게임체인저 가능\"[전문가 인사이...": {"score": 75, "label": "positive", "reasoning": "핵심 오피니언 리더(KOL)의 극찬을 받은 수면 진단 기기의 병원/시장 안착 기대"},
    "에이즈 재발 막는 韓 기술 네이처 논문 등재": {"score": 80, "label": "positive", "reasoning": "최고 권위지(네이처) 등재를 통한 큐리옥스 기술력의 글로벌 공신력 입증 최강 호재"},
    "파마리서치, 재조합단백질 신약개발기업 코넥스트와 '중장기 파트너십'": {"score": 65, "label": "positive", "reasoning": "전략적 투자 및 중장기 파트너십 체결을 통한 점진적 파이프라인 시너지"},
    "폭스재단·NIH가 만든 실적 점프…소마젠, 흑자 성장 시대 개막": {"score": 85, "label": "positive", "reasoning": "글로벌 재단의 수주에 힘입은 사상 최대 실적 및 확고한 흑자 턴어라운드(재무 호재)"},
    "‘아프던 방광암 검사 끝’…지노믹트리 얼리텍-B, 국내 1400억에 해외 성장 어디까지?": {"score": 80, "label": "positive", "reasoning": "국내외 허가 모멘텀 및 조기진단 제품 상용화를 통한 실적 레버리지 구간 진입"},
    "에이프릴바이오, 임상 결과 전 내부자 매도…셀비온·뉴로핏은 강세[바이오 맥짚기]": {"score": 35, "label": "negative", "reasoning": "에이프릴 내부자 매도라는 전형적인 강력 악재(투심 급랭) 발생, 피어그룹은 반사 이익 강세"},
    "\"개량신약·CDMO 전면에\"...다산제약, 올해 IPO 대어 예고": {"score": 70, "label": "positive", "reasoning": "매출 1천억 달성 및 신사업 확장에 기반한 성공적 IPO(상장) 기대감 확산"},
    "'옥석가리기' 본격화된 AI 신약·진단...향후 전망은?[다크호스 플랫폼②]": {"score": 50, "label": "neutral", "reasoning": "단기 호재보다는 옥석 가리기라는 경고성/분석성 의미가 짙은 중립적 산업 리포트"},
    "내부자 매도에 흔들린 에이프릴바이오, 파트너사 임상 성과로 '반전'": {"score": 75, "label": "positive", "reasoning": "내부자 매도 악재(단기 15% 하락)를 극적으로 상쇄하는 파트너사 임상 성공 소식 출현 (극적 반전)"},
    "Alteogen Sees Temporary Dip in Investor Sentiment Market Turns Cautious[K-Bio Pulse]": {"score": 45, "label": "neutral", "reasoning": "알테오젠 등의 일시적 하락(Dip) 및 투자 심리 약화(경계감) 영문 보도"},
    "올해 주목되는 글로벌 바이오시장 키워드 '신경질환·항암·비만'": {"score": 65, "label": "positive", "reasoning": "메가 트렌드(비만, 항암 등) 시장 분석 리포트로 섹터 내 연관 종목에 장기 우호적 환경 조성"},
    "'바토클리맙' 상용화 삐걱…한올바이오파마 \"일본 카드 남았다\"": {"score": 35, "label": "negative", "reasoning": "핵심 파이프라인의 글로벌 권리 반환, 신공장 투자 중단 등 연쇄적 펀더멘탈 악재 직면"}
}

matched_count = 0
for article in articles:
    title = article.get('title', '')
    if title in results_map:
        article['sentiment_score'] = results_map[title]['score']
        article['sentiment_label'] = results_map[title]['label']
        article['gemini_reasoning'] = results_map[title]['reasoning']
        matched_count += 1

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(articles, f, ensure_ascii=False, indent=4)

print(f"✅ Successfully updated {matched_count} more manual analysis results to {output_file}")
