import json
import os

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_classified.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

# The manual results we discussed
results_map = {
    # 0~9
    "조원영 강남지인병원장 “‘웨이메드 엔도’ 등 의료AI 도입 후 진료품질 평균화”[전문가 인사이트]": {"score": 65, "label": "positive", "reasoning": "의료 AI 병원 도입 확대 추세, 산업 긍정적 트렌드"},
    "성장 가능성에 기대감 쏠린 와이투솔루션·유투바이오 '上'[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "이재웅 전 대표 및 대웅 등 대형 파트너 합류로 지배구조 개선 모멘텀 및 상한가"},
    "비알팜텍, 분자접착제 기술 이전 기대에 '上'...앱클론·현대바이오도 ↑ [바이오맥짚기]": {"score": 90, "label": "positive", "reasoning": "수조 원대 기술수출 기대, 오버행 해소, FDA 임상 등 초강력 트리플 호재 분출"},
    "Rznomics·Gencurix, JPMHC Attendees Draw Attention[K-Bio Pulse]": {"score": 70, "label": "positive", "reasoning": "JPMHC 컨퍼런스 참가 및 글로벌 이벤트 기대감"},
    "마이크로디지탈, 북미 시장 진출 본격화…안정적 흑자 궤도 진입": {"score": 85, "label": "positive", "reasoning": "파커하니핀과 북미 진출 파트너십, 매출/영업익 턴어라운드 및 안정적 흑자 전망 가이던스"},
    "'시총 3조' 인실리코메디슨 성공 입증...韓 AI신약개발사 현황은?": {"score": 55, "label": "neutral", "reasoning": "AI 신약개발 전반적 산업 기사, 개별 종목 주가 영향은 제한적"},
    "김동민 제이엘케이 대표 \"美·日서 7개씩 제품 인허가...올해 동시 공략 개시\"": {"score": 80, "label": "positive", "reasoning": "미국과 일본 동시 진출 및 인가 확보, 글로벌 영업 본격화 기대"},
    "\"국내 도매상서 글로벌 의약품 유통 디지털 혁신 퍼스트무버 도약\"[블루엠텍 대해부①]": {"score": 60, "label": "positive", "reasoning": "장기적 디지털 혁신 비전 인터뷰, 강력한 단기 모멘텀보다는 장기 성장 스토리"},
    "메지온, 트럼프 대통령 승인으로 3000억 ‘티켓’ 손에 넣다": {"score": 95, "label": "positive", "reasoning": "트럼프 법안 서명으로 3천억 규모 PRV(우선심사 바우처) 현금 가치 확보, 초특급 재무 호재"},
    "동운아나텍, 글로벌 최초 타액 혈당측정기 연내 상용화될까": {"score": 75, "label": "positive", "reasoning": "세계 최초라는 상징성, 식약처 사전 검토를 통한 연내 상용화 기대감"},
    
    # 10~19
    "엘앤케이바이오메드, 300억 확보...신공장 증설 등에 활용": {"score": 75, "label": "positive", "reasoning": "300억 자금 확보로 2000억 규모 매출 CAPA 증설 목표, 확실한 외형 성장"},
    "환자 모니터링 시장 경쟁 2라운드, 이영신 씨어스 대표의 자신감…배경은?": {"score": 65, "label": "positive", "reasoning": "미국 시장 진출 계획 및 기업 IR을 통한 경쟁력 어필"},
    "상한가 먼저, 공시는 밤에…셀레믹스, 최대주주 변경[바이오맥짚기]": {"score": 45, "label": "neutral", "reasoning": "투기 의혹(올빼미 공시) 및 시장 전반의 다른 제약/바이오 피어그룹 급락 동조화"},
    "Celemics hits limit before after hours filing[K-Bio Pulse]": {"score": 45, "label": "neutral", "reasoning": "위 기사와 동일 (투기 논란 및 시장 하향 베팅)"},
    "\"애플과 견주는 수면측정 기술...글로벌 기기 중 최고 정확도 기록\"[에이슬립 대해부②]": {"score": 80, "label": "positive", "reasoning": "애플, 삼성 등 글로벌 빅테크와의 객관적 지표 우위 확보 (비상장이라도 강력한 펀더멘탈)"},
    "유투바이오·파로스아이·JLK 동반 상승…AI신약·의료 날았다[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "대기업과의 지분 제휴, 영업 안착 등 기대감이 실체화되면서 동반 급등장 연출"},
    "\"KAIST 연구실서 글로벌 슬립테크 강자로 도약\" [에이슬립 대해부①]": {"score": 75, "label": "positive", "reasoning": "파산 위기와 구조조정을 딛고 창사 이래 첫 월간 흑자전환 달성"},
    "BL PharmTech hits five straight limit ups...GemVax extends rally [K-bio pulse]": {"score": 90, "label": "positive", "reasoning": "5연속 상한가라는 강력한 랠리와 기술이전, 계열사 조건부 허가 등 극도의 매수심리 과열"},
    "'항암·CAR-T 효과 분석 데이터 인프라'…CJ바사, 마이크로바이옴 新 전략": {"score": 70, "label": "positive", "reasoning": "데이터 인프라 비즈니스로 신사업 모델 피봇팅하여 밸류에이션 확장 기대"},
    
    # 20~29
    "메디톡스, ‘뉴로더마’ 화장품 유럽 진출 본격화": {"score": 65, "label": "positive", "reasoning": "신규 화장품 브랜드 사업 유럽 진출, 점진적 매출 증대 기대감"},
    "'의료 인공지능' 제이엘케이·코어라인·메디아나 나란히 '上'[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "섹터 전반의 FDA 허가 기대감 및 실질적인 병원 도입/계약 호조로 나란히 상한가"},
    "아이센스·유비케어·동운아나텍, CES 2026서 '혁신상' 수상 소식에 동반 급등[바이오맥짚기]": {"score": 75, "label": "positive", "reasoning": "CES 기술 혁신상 수상을 통해 글로벌 마케팅 모멘텀 입증 및 수급 유입"},
    "i-SENS, Ubicare, Dongwoon Anatech Soar on CES Innovation Awards[K-Bio Pulse]": {"score": 75, "label": "positive", "reasoning": "위 CES 모멘텀 기사 동조화"},
    "휴온스그룹, '글로벌 초격차 바이오헬스기업' 도약…연구개발 등 투자 확대": {"score": 60, "label": "positive", "reasoning": "장기 비전 및 투자 가이던스 제시 (단기적 주가 폭등 재료보다는 장기 우상향 포석)"},
    "Huons Group Accelerates R&D, Expansion to Become ‘Global Super-Gap...’ [K-Bio Pulse]": {"score": 60, "label": "positive", "reasoning": "위 기업 비전 공표 기사 동조화"},
    "'임상 본격화' 현대바이오·현대ADM 동반 '上'...시지메드텍·엔지켐도 ↑[바이오...": {"score": 85, "label": "positive", "reasoning": "베트남 뎅기열 치료제 임상 등 연내 뚜렷한 상용화 타임라인 제시되며 상한가"},
    "Hyundai Bio, Hyundai ADM Hit Limit Up on Clinical Trial Pts...[K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "위 현대 임상 모멘텀 기사 동조화"},
    "Bio Stocks Unfazed by ‘Black Monday’ Rout...Neurophet and BL Pharmtech Surge [K-Bio Pulse]": {"score": 80, "label": "positive", "reasoning": "시황 하락(블랙먼데)에도 바이오텍은 피난처(Safe Haven) 구실을 하며 투심 방어력 입증"},
    
    # 30~50
    "\"혈액 2방울로 30분만에 뇌졸중 진단\"... 젤로스, 일본 넘어 글로벌 진출 시동[젤로스 대해부]": {"score": 80, "label": "positive", "reasoning": "획기적 진단키트 타임라인 제시 및 글로벌 진출 구체화"},
    "동국제약·휴메딕스·엘앤씨바이오 ‘기술 전이’ 전략 잭팟…다음 타자는": {"score": 75, "label": "positive", "reasoning": "캐시카우를 바탕으로 뛰어든 신수종 사업들이 연달아 성공하며 매출 점프업 시현"},
    "‘30년 덴탈·3D프린팅 노하우’ 세계 최초 형상기억 투명교정장치 바탕[그래피 대해부]①": {"score": 70, "label": "positive", "reasoning": "세계 최초 신기술에 특화된 밸류부여, 중장기 호재"},
    "Graphy to Launch World’s First Shape Memory Aligner Next Month [K-Bio Pulse]": {"score": 75, "label": "positive", "reasoning": "다음 달 출시라는 임박한 모멘텀 (단기 촉매제 구실)"},
    "광동제약, 판권 보유 노안치료제 FDA 승인 '上'...유투바이오·코아스템켐온도 ↑[바이오맥짚...": {"score": 90, "label": "positive", "reasoning": "FDA 승인 (제약/바이오 최고등급 호재)으로 연관 기업 상한가"},
    "Yuvezzi Approval Lifts Kwangdong...Biotoxtech Jumps on Record Primate Deal[K-Bio Pulse]": {"score": 90, "label": "positive", "reasoning": "FDA 승인 및 역대 최대 규모 영장류 임상수주(재무성과 입증) 동반"},
    "최대 9일간 효과 지속 비만약 'GLP-1' 무장…펩트론 '블록버스터' 대열 합류": {"score": 85, "label": "positive", "reasoning": "GLP-1 블록버스터 기대감 및 투여 간격 극대화 경쟁력 부각"},
    "홍유석 지놈앤컴퍼니 대표 \"전임상 단계 ADC신약 2건 추가 기술 이전 목표\"": {"score": 70, "label": "positive", "reasoning": "트렌디한 ADC 기술 추가 L/O 경영진 의지 표명"},
    "셀비온·지브레인, 국책과제 및 M&A로 도약[바이오맥짚기]": {"score": 75, "label": "positive", "reasoning": "자금 조달 및 M&A 등 명확한 외형확장 이벤트"},
    "Cellbion Picks Up Speed...G-brain Gears Up for M&A [K-Bio Pulse]": {"score": 75, "label": "positive", "reasoning": "위 M&A 및 국책과제 동조화 보도"},
    "‘7조 이익 목표’ 노바티스 합류…제테마 기술력 세계가 인정했다 [제테마 대해부②]": {"score": 85, "label": "positive", "reasoning": "노바티스라는 거대 글로벌 빅파마 협력 포트폴리오 편입 성공"},
    "한독, ‘오픈 이노베이션’ 결실 맺나…항암·희귀질환 앞세워 올해 대도약 '잰걸음'": {"score": 65, "label": "positive", "reasoning": "전략적 파트너십 구축 및 점진적 체질개선 포석"},
    "이영신 씨어스테크놀로지 대표 \"원격의료 본격화...3월께 정부와 재택진료 사업 시행\"": {"score": 80, "label": "positive", "reasoning": "B2G 타겟으로 3월이라는 임박한 타임라인 제시 (기획보다 실증)"},
    "메디포스트 “‘카티스템’ 韓 3상보다 부담 덜한 설계…美 3상 성공 자신”": {"score": 75, "label": "positive", "reasoning": "미국 FDA 임상 3상 진입(IND)이라는 고문턱 돌파 및 낮은 실패 리스크 어필"},
    "'텐배거' 초기 들어선 K의료기기 삼총사...올해 임계점 돌파 예고": {"score": 85, "label": "positive", "reasoning": "실적 2배 증가, 텐배거 주가 점프업 등 노골적인 수급 및 투심 자극 기사"},
    "예병덕 서울아산병원 교수 \"램시마SC, 정맥주사대비 환자 편의성 월등\"[전문가 인사이트]": {"score": 75, "label": "positive", "reasoning": "최고 임상 교수(KOL)의 공개적 극찬으로 보험 처방 및 채택율 증대 효과 부여"},
    "[2026 유망바이오 톱10]제테마, 미국에 승부 던졌다… 1조 매출 향한 풀스윙⑥": {"score": 70, "label": "positive", "reasoning": "미국 진출 및 파이프라인 조 단위 매출 기대감 (미래 비전)"},
    "양동원 서울성모병원 부원장 “레켐비에 슈퍼브레인 더하니, 치매 지연 효과 15%p 더 개선”[전문가 인...": {"score": 80, "label": "positive", "reasoning": "선두 약물(레켐비)과 병용시 실질적 치료 효과 시너지 입증"},
    "셀비온·큐라클, 임상 성과에 사업화 기대 점화[바이오맥짚기]": {"score": 80, "label": "positive", "reasoning": "신장질환 2상(B) 통과 등 통계적 유의성 확보라는 뚜렷한 돌파구"},
    "日서 렉라자·리브리반트 위장관 출혈 증례보고…항응고제 병용투여 영향 가능성": {"score": 30, "label": "negative", "reasoning": "주력 파이프라인(렉라자) 환자 사망 쇼크, 가장 강력한 단독 악재"},
}

matched_count = 0
for article in articles:
    title = article.get('title', '')
    if title in results_map:
        article['sentiment_score'] = results_map[title]['score']
        article['sentiment_label'] = results_map[title]['label']
        article['gemini_reasoning'] = results_map[title]['reasoning']
        matched_count += 1
    elif 'sentiment_score' not in article:
        # Default placeholder for articles we didn't discuss
        article['sentiment_score'] = 50 
        article['sentiment_label'] = 'neutral'
        article['gemini_reasoning'] = '분석 미진행 (기본값)'

with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(articles, f, ensure_ascii=False, indent=4)

print(f"✅ Successfully saved {matched_count} manual analysis results to {output_file}")
