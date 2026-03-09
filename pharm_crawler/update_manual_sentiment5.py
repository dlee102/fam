import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

# Update the sentiments we just discussed for indexes 260~268
results_map = {
    "이동헌 에이슬립 대표 \"착용 없는 수면 데이터, 글로벌 표준 만들 것\" [에이슬립 대해부③]": {"score": 75, "label": "positive", "reasoning": "착용 없는(비접촉) 수면 데이터 기술력을 통한 글로벌 표준화 선점 의지 표명"},
    "영원한 강자 없다(?)...시험대 오른 비만약 제왕 노보노디스크 [클릭, 글로벌 제약·바이오]": {"score": 55, "label": "neutral", "reasoning": "노보노디스크(글로벌 제약사)의 위기론 및 후발 주자 경쟁 심화를 다룬 산업 분석 기사"},
    "Long-Acting Injectables Gain Momentum in the New Year...Samik Pharm and G2GBio Surge[K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "장기 지속형 주사제(장기지속성) 모멘텀 부각으로 삼익제약 등 관련주 강세 영문 보도"},
    "Yuvezzi Approval Lifts Kwangdong...Biotoxtech Jumps on Record Primate Deal[K-Bio Pulse] (중복)": {"score": 90, "label": "positive", "reasoning": "광동제약 FDA 승인 호재 및 바이오톡스텍 영장류 최대 계약 호재 (중복 처리)"},
    "Hanmi Science Jumps Amid Power Struggle Over Corporate Control[K-BIO Pulse]": {"score": 85, "label": "positive", "reasoning": "경영권 분쟁(Power Struggle) 발발로 인한 지분 확보 경쟁 기대감으로 주가 급등 시현"},
    "케어젠 'CG-P5' 1상 마침표…신약개발사 전환 시험대": {"score": 65, "label": "positive", "reasoning": "임상 1상 선방(마침표)을 통한 신약개발사로의 전환점 마련 (폭발적 단기 모멘텀보다는 중장기 과제)"},
    "ASF outbreak lifts Komipharm...Biodyne gains spotlight[K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "아프리카돼지열병(ASF) 발병에 따른 코미팜 등 백신/방역 관련주 급등 모멘텀"},
    "JPMHC 참석 기업 주목…'유봇' 기대감에 WSI↑[바이오맥짚기]": {"score": 75, "label": "positive", "reasoning": "JP모건 헬스케어 컨퍼런스 참가 및 의료로봇 '유봇' 인허가 기대감 부각으로 상승"},
    "'매출 더블업 성장' 넥스트바이오메디컬, 올해 첫 연간 흑자 전환 예고": {"score": 85, "label": "positive", "reasoning": "매출 2배 성장 및 창사 이래 첫 연간 흑자 전환(Turnaround) 강력 가이던스 제시"}
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
