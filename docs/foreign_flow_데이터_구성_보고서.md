# foreign_flow.parquet 데이터 구성 보고서

**작성일**: 2026-03-06  
**대상**: fam/foreign-high/date=YYYYMMDD/foreign_flow.parquet  
**분석 기준**: 20250109 ~ 20250121 (9일치)

---

## 1. 개요

`foreign-high` 폴더의 `foreign_flow.parquet`는 **종목별·시계열** 외국인/기관 수급 데이터를 담은 Parquet 파일이다.  
일별 파티션(`date=YYYYMMDD`)으로 저장되며, 장중 수 초 단위로 갱신되는 스냅샷 형태이다.

---

## 2. 파일 구조

```
fam/foreign-high/
├── date=20250109/
│   └── foreign_flow.parquet   (~12 MB)
├── date=20250110/
│   └── foreign_flow.parquet   (~14 MB)
├── date=20250113/
│   └── foreign_flow.parquet   (~13 MB)
├── ...
└── date=20250121/
    └── foreign_flow.parquet   (~11 MB)
```

- **형식**: Apache Parquet (컬럼형)
- **파티션**: `date=YYYYMMDD` (거래일 기준)
- **파일당 크기**: 약 11~14 MB

---

## 3. 스키마 (20컬럼)

| # | 컬럼명 | 타입 | 설명 |
|---|--------|------|------|
| 1 | symbol | string | 종목 식별자 (ISIN, 예: KR7005930003) |
| 2 | ts_ms | int64 | 타임스탬프 (밀리초, Unix epoch) |
| 3 | foreign_buy | int64 | 외국인 매수 누적 (원) |
| 4 | foreign_sell | int64 | 외국인 매도 누적 (원) |
| 5 | foreign_net | int64 | 외국인 순매수 (원) = buy - sell |
| 6 | foreign_buy_qty | int64 | 외국인 매수 누적 (주) |
| 7 | foreign_sell_qty | int64 | 외국인 매도 누적 (주) |
| 8 | foreign_net_qty | int64 | 외국인 순매수 (주) = buy_qty - sell_qty |
| 9 | foreign_buy_delta | int64 | 전 레코드 대비 매수 변화량 (원) |
| 10 | foreign_sell_delta | int64 | 전 레코드 대비 매도 변화량 (원) |
| 11 | foreign_net_delta | int64 | 전 레코드 대비 순매수 변화량 (원) |
| 12 | foreign_buy_qty_delta | int64 | 전 레코드 대비 매수 수량 변화 (주) |
| 13 | foreign_sell_qty_delta | int64 | 전 레코드 대비 매도 수량 변화 (주) |
| 14 | foreign_net_qty_delta | int64 | 전 레코드 대비 순매수 수량 변화 (주) |
| 15 | institution_buy | int64 | 기관 매수 누적 (원) |
| 16 | institution_sell | int64 | 기관 매도 누적 (원) |
| 17 | institution_net | int64 | 기관 순매수 (원) |
| 18 | institution_buy_delta | int64 | 기관 매수 변화량 (원) |
| 19 | institution_sell_delta | int64 | 기관 매도 변화량 (원) |
| 20 | institution_net_delta | int64 | 기관 순매수 변화량 (원) |

---

## 4. 데이터 특성

### 4.1 레코드 단위

- **1행** = 특정 종목(symbol)의 특정 시점(ts_ms)에서의 수급 스냅샷
- **같은 종목**은 시간순으로 여러 행 존재 (시계열)
- **다른 종목**은 서로 독립적으로 시간축을 가짐

### 4.2 누적값 vs 변화량

| 구분 | 컬럼 | 의미 |
|------|------|------|
| **누적** | foreign_buy, foreign_sell, foreign_net | 당일 09:00~해당 시점까지의 합계 |
| **누적** | foreign_buy_qty, foreign_sell_qty, foreign_net_qty | 당일 누적 수량 |
| **변화량** | foreign_*_delta | 이전 레코드(같은 종목) 대비 증분 |

- `foreign_net = foreign_buy - foreign_sell` (항상 성립)
- `foreign_net_qty = foreign_buy_qty - foreign_sell_qty` (항상 성립)

### 4.3 단위

| 항목 | 단위 | 예시 |
|------|------|------|
| foreign_* (원) | 원화 | 6,000,000,000 = 60억원 |
| foreign_*_qty | 주 | 152,290,000 = 1억 5,229만주 |
| ts_ms | 밀리초 | 1736466004619 = 2025-01-10 09:30:00.619 KST |

---

## 5. 시계열 구조 (샘플)

**종목 KR7005930003 (삼성전자) 20250110 일부:**

| ts_ms | foreign_buy | foreign_sell | foreign_net | foreign_buy_qty | foreign_sell_qty | foreign_net_qty | buy_delta | sell_delta | net_delta |
|-------|-------------|--------------|-------------|-----------------|------------------|-----------------|-----------|------------|-----------|
| 1736466004619 | 60억 | 60억 | 0 | 1.52억 | 1.52억 | 0 | 0 | 0 | 0 |
| 1736466015467 | 60억 | 60억 | 0 | 1.91억 | 1.91억 | 0 | 0 | 0 | 0 |
| 1736466031165 | 90억 | 90억 | 0 | 1.91억 | 1.91억 | 0 | 30억 | 30억 | 0 |
| 1736466062284 | 90억 | 90억 | 0 | 2.66억 | 2.66억 | 0 | 0 | 0 | 0 |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |

- **buy/sell 누적**: 시점마다 증가 (또는 동일)
- **net**: buy - sell, 순매수/순매도 방향 표현
- **delta**: 이전 행 대비 변화 (변화 없으면 0)

---

## 6. 분포 요약

| 항목 | 값 |
|------|-----|
| 일당 레코드 수 | 약 98만~108만건 |
| 종목 수 | 826개 |
| 종목당 레코드 수 | 24건 ~ 7.7만건 (거래량 비례) |
| 갱신 주기 | 중앙 3~4초 (종목별 상이) |
| 장중 시간 | 09:00~15:30 KST 집중 |
| delta=0 비율 | 약 86% (대부분 변화 없음) |

---

## 7. 사용 시 유의사항

1. **ts_ms**: UTC 기준이 아닐 수 있음. KST(UTC+9)로 해석하는 경우가 많음.
2. **foreign_net 범위**: -90억~+90억 구간으로 클리핑/스케일링된 것으로 추정.
3. **장마감 누적**: 해당 일의 마지막 레코드(ts_ms 최대)가 당일 최종 누적값.
4. **delta**: 같은 종목 내 시간순 정렬 후 계산된 값으로 추정.

---

## 8. 참조

- `quant/data/loader.py`: `load_foreign_flow(date)` — foreign-high 우선 로드
- `quant/scores/foreign_flow_score.py`: 외국인 순매수 기반 점수 산출
- `docs/외국인_수급_수집_보고서.md`: KOSCOM 로그 vs foreign 데이터 관계
