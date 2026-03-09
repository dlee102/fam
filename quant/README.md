# Quant Score Library

books, trades, foreign_flow parquet 데이터로 퀀트 점수 계산.

## 구조

```
quant/
├── config.py              # 데이터 경로 (02.TRADING2/04. data)
├── data/
│   ├── loader.py          # parquet 로더
│   └── __init__.py
├── scores/
│   ├── foreign_flow_score.py   # 외국인 순매수 점수 0~100
│   ├── volume_score.py        # 거래량 점수 0~100
│   ├── orderbook_score.py     # 호가 불균형 점수 0~100
│   ├── momentum_score.py      # 일중 수익률 점수 0~100
│   ├── trend_score.py         # 일중 추세 점수 0~100
│   ├── spread_score.py        # 호가 스프레드(유동성) 점수 0~100
│   └── __init__.py
├── run.py                 # CLI
└── README.md
```

## 사용법

### Python CLI

```bash
# 전체 종목 점수 (JSON)
python3 -m quant.run 20240102

# 단일 종목
python3 -m quant.run 20240102 --symbol KR7000020008

# 테이블 출력
python3 -m quant.run 20240102 --format table
```

### API

```
GET /api/quant/scores?date=20240102&symbol=KR7000020008
```

### 점수 설명

| 점수 | 설명 | 0~100 의미 |
|------|------|------------|
| foreign_flow | 외국인 순매수(금액) percentile | 높을수록 순매수 강함 |
| volume | 누적거래량 percentile | 높을수록 거래 활발 |
| orderbook_imbalance | bid/ask 총량 불균형 | 50=중립, 100=매수우위 |
| momentum | 일중 수익률 (종가-시가)/시가 percentile | 높을수록 상승 |
| trend | 일중 추세 (고가-저가 대비 방향) | 50=횡보, 100=강한 상승 |
| spread | 1호가 스프레드 역 percentile | 높을수록 유동성 좋음 |

## 의존성

```bash
pip install -r requirements-quant.txt
```
