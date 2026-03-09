# FAM

React + Next.js + Node 기반 기본 프레임워크

## 스택

- **React 18** - UI 라이브러리
- **Next.js 14** - React 프레임워크 (App Router)
- **Node.js** - 런타임 (API Routes 포함)

## 시작하기

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build

# 프로덕션 서버 실행
npm start
```

## 구조

```
fam/
├── app/
│   ├── api/health/route.ts   # API Route (Node 백엔드)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── next.config.js
├── package.json
└── tsconfig.json
```

## API

- `GET /api/health` - 헬스체크 엔드포인트
- `GET /api/quant/scores?date=YYYYMMDD&symbol=ISIN` - 퀀트 점수 (외국인 수급, 거래량, 호가 불균형)

## 퀀트 점수 (quant/)

`02.TRADING2/04. data` 의 books, trades, foreign_flow parquet 기반 점수 계산.

```bash
pip install -r requirements-quant.txt
python3 -m quant.run 20240102 --symbol KR7000020008
```

자세한 내용은 `quant/README.md` 참고.
