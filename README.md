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
