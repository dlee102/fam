import json
import re

private_companies = [
    "지브레인", "G-Brain", "에이슬립", "Asleep", "코넥티브", "Connective",
    "인벤테라", "Inventera", "에이티센스", "ATsense", "엠투웬티", "M20",
    "에이아이메딕", "메디픽셀", "갤럭스", "히츠", "HITS", "로완", "Rowan",
    "스카이랩스", "SkyLabs", "디시젠", "Dizigen", "카나프테라퓨틱스", "Kanaph",
    "인제니아", "Ingenia", "진에딧", "GenEdit", "파인트리", "Pinetree",
    "카이진", "Kaigene", "메쥬", "Mezoo", "포스트바이오", "PostBio",
    "에버레스", "Everess", "웰리시스", "Wellysis", "뉴로핏", "NEUROPHET",
    "앱노트랙", "ApnoTrack", "슬립큐", "SleepQ"
]

global_companies = {
    "노보노디스크": "NVO", "Novo Nordisk": "NVO",
    "일라이릴리": "LLY", "Eli Lilly": "LLY",
    "머크": "MRK", "MSD": "MRK",
    "로슈": "ROG", "Roche": "ROG",
    "사노피": "SNY", "Sanofi": "SNY",
    "글락소스미스클라인": "GSK", "GSK": "GSK",
    "화이자": "PFE", "Pfizer": "PFE",
    "아스트라제네카": "AZN", "AstraZeneca": "AZN"
}

# Tickers already found but maybe missed in some articles
known_public = {
    "알테오젠": "196170", "HLB": "028300", "한미약품": "128940", "한미사이언스": "008930",
    "리가켐바이오": "141080", "셀비온": "308430", "큐라클": "318020", "젬백스": "082270",
    "삼성제약": "001360", "비엘팜텍": "065170", "현대바이오": "048410", "현대ADM": "187660",
    "툴젠": "199800", "젠큐릭스": "229000", "셀루메드": "049180", "파로스아이바이오": "388870",
    "오름테라퓨틱": "475830", "삼양홀딩스": "000070", "유투바이오": "221800",
    "지아이이노베이션": "358570", "삼천당제약": "000250", "광동제약": "009290",
    "아이센스": "099190", "파미셀": "005690", "클래시스": "214150", "메디포스트": "078160",
    "라파스": "214260", "오스코텍": "039200", "유한양행": "000100", "보령": "003850",
    "셀트리온": "068270", "삼성바이오로직스": "207940", "에스디바이오센서": "137310",
    "디앤디파마텍": "347850", "큐리옥스": "445680", "리브스메드": "491000",
    "엑셀세라퓨틱스": "373110", "삼일제약": "000520", "대원제약": "003220",
    "유유제약": "000220", "휴메딕스": "200670", "셀레믹스": "331920",
    "아이엠비디엑스": "461030", "에이비엘바이오": "298380", "레이저옵텍": "199550",
    "엔솔바이오": "140610", "엘앤케이바이오": "156100", "프롬바이오": "377220",
    "현대약품": "004310", "씨어스": "458870", "루닛": "328130", "뷰노": "338220",
    "코어라인": "384470", "바이오다인": "314930", "코미팜": "041960"
}

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'r') as f:
    data = json.load(f)

updated_count = 0
for article in data:
    title = article.get('title', '')
    body = article.get('body', '') or ''
    full_text = title + " " + body
    
    tickers = set(article.get('tickers', []))
    
    # 1. Check for known public companies first
    for name, ticker in known_public.items():
        if name in full_text:
            tickers.add(ticker)
            
    # 2. Check for global companies
    for name, symbol in global_companies.items():
        if name in full_text:
            tickers.add(symbol)
            
    # 3. Check for private companies
    is_private = False
    for name in private_companies:
        if name in full_text:
            is_private = True
            break
    
    if is_private and len([t for t in tickers if t != "비상장"]) == 0:
        # Only mark as private if no public tickers found
        tickers.add("비상장")
    elif is_private:
        # If public ticker found but also private partner, we keep both or just public?
        # User said "비상장은 비상장으로 하고", let's include it.
        tickers.add("비상장")

    # 4. Filter out redundant "비상장" if public tickers are present (optional, but let's keep it if user wants to see it)
    
    new_tickers_list = sorted(list(tickers))
    if new_tickers_list != article.get('tickers'):
        article['tickers'] = new_tickers_list
        updated_count += 1

with open('/Users/qraft_deullee/Music/Documents/02. MX /fam/pharm_crawler/pharm_articles_manual_sentiment.json', 'w') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print(f"✅ Refined tickers for {updated_count} articles.")
