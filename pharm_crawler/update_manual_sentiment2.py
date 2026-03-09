import json

input_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'
output_file = '/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json'

with open(input_file, 'r', encoding='utf-8') as f:
    articles = json.load(f)

# Update the sentiments we just discussed for indexes 50~159
results_map = {
    "상장주관사 바꾼 동운아나텍, 연내 퀀텀점프 노린다": {"score": 65, "label": "positive", "reasoning": "상장 주관사 변경 및 연내 실적 도약에 대한 의지 표명"},
    "동운아나텍 '디썰라이프' 임상 신청서 식약처 제출...내년 초 결과 기대": {"score": 75, "label": "positive", "reasoning": "세계 최초 타액 혈당측정기 임상 신청서 제출 및 단기 타임라인 제시"},
    "Dongwoon Anatech Submits Application for Saliva Glucose...[K-Bio Pulse]": {"score": 75, "label": "positive", "reasoning": "단기 상용화 일정 영어 브리핑"},
    "유유제약, 체질 개선 '가속페달'…배당 2배↑ 100억 자사주 매입": {"score": 85, "label": "positive", "reasoning": "배당 2배 증액 및 자사주 매입이라는 확실한 밸류업 호재"},
    "Yuyu Pharma Ramps Up Value... Doubles Dividend and... [K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "우수한 밸류업 영어 브리핑"},
    "'K-비만약 도약기' 한미 vs 유한 승자는...에페글레나타이드 ‘정조준’": {"score": 70, "label": "positive", "reasoning": "비만 치료제 시장 성장성 재확인 산업 리포트"},
    "올해 실적 퀀텀점프 ‘셀루메드’, FDA 승인 등 겹호재에 성장판 열린다": {"score": 85, "label": "positive", "reasoning": "FDA 승인과 실적 퀀텀점프 겹호재"},
    "'1상 문턱' 못 넘은 신풍제약 피라맥스 등 국산 코로나 신약 '줄줄이 실패'": {"score": 20, "label": "negative", "reasoning": "임상 1상 실패라는 명확한 악재 및 실망 매물 시현"},
    "\"상급종합병원서 암환자까지 커버\" 제이엘케이 '초격차' 비결 들어보니[대해부]②": {"score": 75, "label": "positive", "reasoning": "핵심 의료 기관 레퍼런스 확장을 통한 기술 입증"},
    "\"AI로 치매환자 조기진단\"...'뷰노메드 딥브레인' 美 FDA 승인 확신[뷰노 대해부]①": {"score": 80, "label": "positive", "reasoning": "가장 핵심적인 모멘텀인 'FDA 승인 임박/확신' 강조"},
    "뷰노·루닛 상장 전후 수익률 극과극...의료AI IPO 성적표 해부": {"score": 50, "label": "neutral", "reasoning": "상장 전후 통계성 분석 (개별 호재 아님)"},
    "\"시총 7000억 회복할 것\"…안국약품, M&A·주주친화 '투트랙' 드라이브": {"score": 80, "label": "positive", "reasoning": "경영진의 구체적 시총 가이던스 동반 주주친화 목적 표명"},
    "‘식약처 허가 전 판권 독점’…한미약품, 비만약 시장 선점 승부수 던졌다": {"score": 85, "label": "positive", "reasoning": "선제적 판권 확보 통한 강한 매출 증대 기대감"},
    "'1200억 밸류' 노벨티노빌리티, 상장철회 7개월새 달라진 세 가지": {"score": 65, "label": "positive", "reasoning": "기술 이전 모멘텀 재도약 기대"},
    "1세대 바이오 저력...글로벌 기업 기반 닦는다[셀비온 대해부]①": {"score": 75, "label": "positive", "reasoning": "전립선암 신약 국내 품목 허가 신청 모멘텀"},
    "큐라클 CU01 임상 2b상 성공...'케렌디아 한계 넘어 고칼륨 위험 없는 게임체인저'": {"score": 85, "label": "positive", "reasoning": "임상 2b상 성공(통계적 유의성 확보) 및 부작용 한계 극복"},
    "김해진 엔솔바이오 대표 “골관절염 신약 근본치료제 검증 최종 단계 돌입...빅파마 큰 관심”": {"score": 80, "label": "positive", "reasoning": "근본치료제 임상 3상 진입 예정 및 빅파마 기술이전 기대 증폭"},
    "강국진 엘앤케이바이오 회장 “글로벌 기업과 유통 논의 95% 완료…매출 1000억 목표”": {"score": 85, "label": "positive", "reasoning": "유통 계약 사실상 완료(95%) 및 높은 매출액 가이던스(천억) 확보"},
    "“빠진 머리 다시 자라게 한다?”…JW중외제약, ‘모낭 재생’ 탈모 신약 판 흔든다": {"score": 80, "label": "positive", "reasoning": "새로운 메커니즘을 내세운 핵심기술 미국 특허 등록 사실 보도"},
    "'코스닥150 편입' 에임드바이오 급등…바텍·국전약품 上[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "코스닥 150 편입 패시브 연계와 HBM 모멘텀 등 상한가 달성 터치"},
    "적자 잔혹사 고리 끊은 GC녹십자…알리글로 투트랙 전략으로 성장 박차": {"score": 90, "label": "positive", "reasoning": "8년 4분기 연속 적자 탈출, 알리글로 FDA 진입으로 완벽한 경영 턴어라운드 입증"},
    "[2026 유망바이오 톱10]엘앤씨바이오, '품절템' 리투오 앞세워 사상 최대 실적 예고①": {"score": 75, "label": "positive", "reasoning": "사상 최대 실적 달성 가이던스 제시"},
    "인투셀, 플랫폼 가치 입증하려면…'복수 기술이전'이 반등 열쇠": {"score": 55, "label": "neutral", "reasoning": "역성장에 대한 기술 반전 기대감 (당장의 호재 부족)"},
    "K바이오 골관절염 치료제, FDA 허가 따놓은 당상인 이유": {"score": 75, "label": "positive", "reasoning": "FDA 품목허가 기대감 및 투심 안정화 재료"},
    "냉탕 온탕 오간 에이프릴바이오…실적 호조에 로킷·휴젤 상승[바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "임상 2a 성공 상한가 및 타기업 역대급 실적 호조 등 동반 상승 견인"},
    "BL Pharmtech Hits Upper Limit on Expectations for Molecular Glue Technology License Out[K-bio pul...": {"score": 85, "label": "positive", "reasoning": "분자접착제 L/O 기대 상한가 팩터 영문"},
    "‘룬드벡 연례보고서 언급’ 콘테라파마…RNA 기술 추가 파트너십도 기대": {"score": 60, "label": "positive", "reasoning": "글로벌 제약사 보고서 언급 파트너십 기대"},
    "백신 사업도 고수익 사업 입증…유바이오로직스, 폭발적 성장 비결": {"score": 85, "label": "positive", "reasoning": "영업이익률 40% 도달하며 폭발적 이익/고수익성 입증"},
    "메디포스트 '카티스템' 日 임상 3상 종료…2분기 결과 발표": {"score": 75, "label": "positive", "reasoning": "일본 3상 종료 임박 (단기 타임라인 발표)"},
    "김현수 휴비츠 대표 “올해 ‘게임체인저’ OCT 구강스캐너 출시…기술 접목 계속”": {"score": 70, "label": "positive", "reasoning": "기존 안광학에서 디지털 덴티스트리로 사업 영역 확대"},
    "'법차손 이슈 해결’ 퀀타매트릭스, 신속 항생제 솔루션 앞세워 반등 예고": {"score": 75, "label": "positive", "reasoning": "고질적 재무 리스크(법차손) 자본 확충 해소 및 실적 반등 예고"},
    "진양곤 HLB 의장 \"'삼고초려' 영입 김태한, 간암신약 상용화 등 역량 발휘 기대\"": {"score": 75, "label": "positive", "reasoning": "상징적 경영진(전 삼바 대표) 수혈로 상용화 돌파 기대감 강화"},
    "필수항목된 美바이오 대관... 104억 쏟은 삼성, 오너家 나선 셀트리온": {"score": 65, "label": "positive", "reasoning": "관세 등 대외 변수에 대응하는 대기업 로비/대관 인프라 과시"},
    "Investor Sentiment Lifted by Expectations of ‘Tangible Results’ Ensol Bio & L&K BioMed Surge[K-...": {"score": 75, "label": "positive", "reasoning": "가시적 펀더멘탈 결과 기대 영문 호재"},
    "바이오솔루션, 카티라이프 美 3상 드라이브…“패키지 딜도 고려”": {"score": 75, "label": "positive", "reasoning": "미 3상 진입을 위한 적극적 SI 유치 등 전략적 모멘텀"},
    "김해진 엔솔바이오 대표 “골관절염 신약 근본치료제 검증 최종 단계 돌입...빅파마 큰 관심”": {"score": 80, "label": "positive", "reasoning": "근본치료제 임상 3상 및 빅파마 기술이전 기대"},
    "[2026 유망바이오 톱10]\"다빈치 독점 깬다\"…리브스메드, 90도 꺾는 기술로 흑자 전환②": {"score": 85, "label": "positive", "reasoning": "독점 타파 기술력 입증으로 흑자전환 시그널 동반"},
    "Aimedbio Charges Higher on KOSDAQ 150 Boost[K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "코스닥 150 편입 관련 상한가 터치 영문"},
    "온코닉테라퓨틱스, 올해 매출·영업익 더블업 성장 자신하는 이유": {"score": 80, "label": "positive", "reasoning": "자큐보 판매를 통한 연매출 1천억 가이던스 실적 자신"},
    "유럽 의사들 먼저 알아봤다...넥스트바이오메디컬, ‘인공관절 수술 후 통증’에도 효과": {"score": 75, "label": "positive", "reasoning": "핵심 제품 적응증 확대(통증 완화 효과 확인)로 매출처 볼륨 증대 모멘텀"},
    "Kyungnam Pharm Hits Daily Upper Limit on Share Consolidation Plan[K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "주식 병합(유통수 축소) 이벤트로 상한가 직행"},
    "Surge of the Medical Device Trio... Graphy·Livsmed·WSI Skyrocket [K-Bio Pulse]": {"score": 85, "label": "positive", "reasoning": "의료기기 기술주 삼인방 나란히 급등 폭발 호재"},
    "‘검은 월요일’도 뉴로핏·비엘팜텍 등 바이오 상승세 못 꺾었다↑ [바이오맥짚기]": {"score": 85, "label": "positive", "reasoning": "블랙먼데이 폭락장에도 투심 방어(Safe Haven) 해내는 강력 매수 기조 확인"},
    "Unsolved Hair Loss Seeking a Breakthrough?...FromBio and Hyundai Pharm Surge [K-Bio Pulse]": {"score": 75, "label": "positive", "reasoning": "탈모 치료제 개발 기대 투심 영문"},
    "\"AI영상진단·수술 로봇 모두 갖춘 의료AI계 다크호스\"[코넥티브 대해부①]": {"score": 75, "label": "positive", "reasoning": "진단부터 예후까지 전부 잇는 다크호스 밸류 조명"},
    "ROWAN Signed MoU with Japan’s NCGG and SoftBank Robotics to Accelerate Entry into the Japanese D...": {"score": 75, "label": "positive", "reasoning": "일본 시장 파트너십 구축 B2B 호재"},
    "박세진 유엑스엔 대표 \"연내 세계 첫 백금 CGM 국내 허가...중동도 적극 공략\"": {"score": 75, "label": "positive", "reasoning": "세계 첫 백금 CGM 연속혈당측정기술 상용화 연내 타임라인 공개"},
    "\"근골격계질환 진단부터 사후 관리까지 국내서 유일하게 가능\"[코넥티브 대해부②]": {"score": 75, "label": "positive", "reasoning": "수직계열화 구축 입증 모멘텀"},
    "'임상 본격화' 현대바이오·현대ADM 동반 '上'...시지메드텍·엔지켐도 ↑[바이오...": {"score": 85, "label": "positive", "reasoning": "해외 임상 가시화로 상한가 급등 안착"},
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
