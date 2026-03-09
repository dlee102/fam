# 팜이데일리 크롤러

Chrome 프로필(이미 로그인된 세션)을 사용해 [팜이데일리 프리미엄](https://pharm.edaily.co.kr/News/List_All?cd=PE00) 기사를 수집합니다.

## 사전 준비

1. **Chrome에서 팜이데일리 로그인**
   - https://pharm.edaily.co.kr 접속
   - 구글 계정으로 로그인
   - 프리미엄 기사가 보이는지 확인

2. **Chrome 완전 종료**
   - 실행 전 반드시 Chrome을 모두 종료해야 합니다.
   - 프로필을 동시에 사용하면 충돌합니다.

## 설치

```bash
cd pharm_crawler
pip install -r requirements.txt
```

## 실행

```bash
# 2026-01-01 ~ 오늘 날짜범위 크롤 (봇 차단 방지)
python pharm_crawler.py --pw --start-date 2026-01-01

# 지연 늘리기 (5초, 봇 차단 시)
python pharm_crawler.py --pw --start-date 2026-01-01 --delay 5

# 더보기 50회 (과거 기사 더 수집)
python pharm_crawler.py --pw --start-date 2026-01-01 --scrolls 50

# 기사 10개만 수집 (날짜 무시)
python pharm_crawler.py --pw --max-articles 10
```

## 출력

`pharm_articles.json` (또는 `-o`로 지정한 파일)에 기사 데이터가 저장됩니다.

```json
[
  {
    "url": "https://pharm.edaily.co.kr/News/Read?newsId=...",
    "title": "기사 제목",
    "body": "기사 본문...",
    "date": "2026-03-04 오전 08:30",
    "premium_blocked": false
  }
]
```

`premium_blocked: true`이면 로그인/구독이 안 된 상태입니다.
